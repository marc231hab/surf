/**
 * Multi-day surf forecast using Open-Meteo marine API + tide predictions
 */

import { FOLLY_COORDS, TIDE_STATION } from './types';
import { calculateSurfScoreWithBreakdown, getSurfRating, getRatingColor, type ScoreBreakdown } from './surfModel';

export interface DayForecast {
  date: string;
  dayName: string;
  waveHeight: number;
  wavePeriod: number;
  waveDirection: number;
  windSpeed: number;
  windDirection: number;
  tideRange: { low: number; high: number };
  score: number;
  rating: string;
  colorClass: string;
  breakdown: ScoreBreakdown;
}

interface MarineHourly {
  time: string[];
  wave_height: number[];
  wave_period: number[];
  wave_direction: number[];
}

interface WeatherHourly {
  time: string[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
}

/**
 * Fetch marine forecast from Open-Meteo
 */
async function fetchMarineForecast(): Promise<MarineHourly | null> {
  try {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${FOLLY_COORDS.lat}&longitude=${FOLLY_COORDS.lon}&hourly=wave_height,wave_period,wave_direction&timezone=America/New_York&forecast_days=10`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.hourly;
  } catch (error) {
    console.error('Marine forecast error:', error);
    return null;
  }
}

/**
 * Fetch wind forecast from Open-Meteo
 */
async function fetchWindForecast(): Promise<WeatherHourly | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${FOLLY_COORDS.lat}&longitude=${FOLLY_COORDS.lon}&hourly=wind_speed_10m,wind_direction_10m&timezone=America/New_York&forecast_days=10&wind_speed_unit=kn`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.hourly;
  } catch (error) {
    console.error('Wind forecast error:', error);
    return null;
  }
}

/**
 * Fetch tide predictions for next 10 days
 */
async function fetchTidePredictions(): Promise<Map<string, { low: number; high: number }>> {
  const tidesByDay = new Map<string, { low: number; high: number }>();
  
  try {
    const now = new Date();
    const startDate = now.toISOString().split('T')[0].replace(/-/g, '');
    const endDate = new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0].replace(/-/g, '');
    
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${startDate}&end_date=${endDate}&station=${TIDE_STATION}&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&interval=hilo&format=json`;
    
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return tidesByDay;
    
    const data = await res.json();
    if (!data.predictions) return tidesByDay;
    
    // Group by day
    for (const pred of data.predictions) {
      const dateStr = pred.t.split(' ')[0]; // "2026-03-24"
      const height = parseFloat(pred.v);
      const type = pred.type; // 'H' or 'L'
      
      if (!tidesByDay.has(dateStr)) {
        tidesByDay.set(dateStr, { low: 10, high: -10 });
      }
      
      const day = tidesByDay.get(dateStr)!;
      if (type === 'H' && height > day.high) {
        day.high = height;
      }
      if (type === 'L' && height < day.low) {
        day.low = height;
      }
    }
    
    return tidesByDay;
  } catch (error) {
    console.error('Tide predictions error:', error);
    return tidesByDay;
  }
}

/**
 * Get the best conditions for a given day (peak surfing hours: 6am-6pm)
 */
function getDayConditions(
  date: string,
  marine: MarineHourly,
  weather: WeatherHourly
): { waveHeight: number; wavePeriod: number; waveDirection: number; windSpeed: number; windDirection: number } | null {
  // Find indices for this day during daylight hours (6am-6pm)
  const dayStart = `${date}T06:00`;
  const dayEnd = `${date}T18:00`;
  
  const indices: number[] = [];
  for (let i = 0; i < marine.time.length; i++) {
    const t = marine.time[i];
    if (t >= dayStart && t <= dayEnd) {
      indices.push(i);
    }
  }
  
  if (indices.length === 0) return null;
  
  // Get average/best conditions during the day
  let totalHeight = 0, totalPeriod = 0, totalWaveDir = 0;
  let totalWindSpeed = 0, totalWindDir = 0;
  let count = 0;
  
  for (const i of indices) {
    if (marine.wave_height[i] != null && weather.wind_speed_10m[i] != null) {
      totalHeight += marine.wave_height[i];
      totalPeriod += marine.wave_period[i] || 8;
      totalWaveDir += marine.wave_direction[i] || 170;
      totalWindSpeed += weather.wind_speed_10m[i];
      totalWindDir += weather.wind_direction_10m[i] || 0;
      count++;
    }
  }
  
  if (count === 0) return null;
  
  return {
    waveHeight: Math.round((totalHeight / count) * 3.281 * 10) / 10, // m to ft
    wavePeriod: Math.round((totalPeriod / count) * 10) / 10,
    waveDirection: Math.round(totalWaveDir / count),
    windSpeed: Math.round((totalWindSpeed / count) * 10) / 10,
    windDirection: Math.round(totalWindDir / count),
  };
}

/**
 * Fetch complete 9-day forecast
 */
export interface HourlyForecast {
  time: string; // "2026-03-24T08:00"
  hour: number; // 8
  waveHeight: number;
  wavePeriod: number;
  waveDirection: number;
  windSpeed: number;
  windDirection: number;
  tideHeight: number;
  tideRising: boolean;
  score: number;
  rating: string;
  colorClass: string;
}

export interface DayWithHourly extends DayForecast {
  hourly: HourlyForecast[];
  bestHour: number;
  bestScore: number;
}

/**
 * Fetch hourly tide predictions with rising/falling info
 */
async function fetchHourlyTides(): Promise<Map<string, { height: number; rising: boolean }>> {
  const tidesByHour = new Map<string, { height: number; rising: boolean }>();
  
  try {
    const now = new Date();
    const startDate = now.toISOString().split('T')[0].replace(/-/g, '');
    const endDate = new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0].replace(/-/g, '');
    
    // Get hourly predictions
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${startDate}&end_date=${endDate}&station=${TIDE_STATION}&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&interval=h&format=json`;
    
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return tidesByHour;
    
    const data = await res.json();
    if (!data.predictions || data.predictions.length < 2) return tidesByHour;
    
    // First pass: store all heights
    const heights: { time: string; height: number }[] = [];
    for (const pred of data.predictions) {
      const timeKey = pred.t.replace(' ', 'T');
      heights.push({ time: timeKey, height: parseFloat(pred.v) });
    }
    
    // Second pass: determine rising/falling by comparing to next hour
    for (let i = 0; i < heights.length; i++) {
      const current = heights[i];
      const next = heights[i + 1];
      const rising = next ? next.height > current.height : false;
      tidesByHour.set(current.time, { height: current.height, rising });
    }
    
    return tidesByHour;
  } catch (error) {
    console.error('Hourly tide error:', error);
    return tidesByHour;
  }
}

/**
 * Fetch 9-day forecast with hourly data for each day
 */
export async function fetch9DayForecastWithHourly(): Promise<DayWithHourly[]> {
  const [marine, weather, tides, hourlyTides] = await Promise.all([
    fetchMarineForecast(),
    fetchWindForecast(),
    fetchTidePredictions(),
    fetchHourlyTides(),
  ]);
  
  if (!marine || !weather) {
    return [];
  }
  
  const forecasts: DayWithHourly[] = [];
  const now = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  for (let i = 0; i < 9; i++) {
    const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayNames[date.getDay()];
    
    // Get hourly forecasts for this day (all 24 hours)
    const hourly: HourlyForecast[] = [];
    let bestHour = 8;
    let bestScore = 0;
    
    for (let hour = 0; hour <= 23; hour++) {
      const timeStr = `${dateStr}T${hour.toString().padStart(2, '0')}:00`;
      const idx = marine.time.indexOf(timeStr);
      
      if (idx === -1) continue;
      
      const waveHeight = marine.wave_height[idx] != null 
        ? Math.round(marine.wave_height[idx] * 3.281 * 10) / 10 
        : 0;
      const wavePeriod = marine.wave_period[idx] || 8;
      const waveDirection = marine.wave_direction[idx] || 170;
      const windSpeed = weather.wind_speed_10m[idx] || 0;
      const windDirection = weather.wind_direction_10m[idx] || 0;
      const tideData = hourlyTides.get(timeStr) || { height: 3, rising: true };
      const tideHeight = tideData.height;
      const tideRising = tideData.rising;
      
      const breakdown = calculateSurfScoreWithBreakdown({
        waveHeight,
        wavePeriod,
        waveDirection,
        windSpeed,
        windDirection,
        tideHeight,
        tideRising,
      });
      
      hourly.push({
        time: timeStr,
        hour,
        waveHeight,
        wavePeriod: Math.round(wavePeriod * 10) / 10,
        waveDirection: Math.round(waveDirection),
        windSpeed: Math.round(windSpeed * 10) / 10,
        windDirection: Math.round(windDirection),
        tideHeight: Math.round(tideHeight * 10) / 10,
        tideRising,
        score: breakdown.total,
        rating: getSurfRating(breakdown.total),
        colorClass: getRatingColor(breakdown.total),
      });
      
      if (breakdown.total > bestScore) {
        bestScore = breakdown.total;
        bestHour = hour;
      }
    }
    
    const conditions = getDayConditions(dateStr, marine, weather);
    if (!conditions) continue;
    
    const tideRange = tides.get(dateStr) || { low: 1.5, high: 5.0 };
    const avgTide = (tideRange.low + tideRange.high) / 2;
    
    const breakdown = calculateSurfScoreWithBreakdown({
      waveHeight: conditions.waveHeight,
      wavePeriod: conditions.wavePeriod,
      waveDirection: conditions.waveDirection,
      windSpeed: conditions.windSpeed,
      windDirection: conditions.windDirection,
      tideHeight: avgTide,
      tideRising: true,
    });
    
    forecasts.push({
      date: dateStr,
      dayName,
      waveHeight: conditions.waveHeight,
      wavePeriod: conditions.wavePeriod,
      waveDirection: conditions.waveDirection,
      windSpeed: conditions.windSpeed,
      windDirection: conditions.windDirection,
      tideRange,
      score: breakdown.total,
      rating: getSurfRating(breakdown.total),
      colorClass: getRatingColor(breakdown.total),
      breakdown,
      hourly,
      bestHour,
      bestScore,
    });
  }
  
  return forecasts;
}

export async function fetch9DayForecast(): Promise<DayForecast[]> {
  const [marine, weather, tides] = await Promise.all([
    fetchMarineForecast(),
    fetchWindForecast(),
    fetchTidePredictions(),
  ]);
  
  if (!marine || !weather) {
    return [];
  }
  
  const forecasts: DayForecast[] = [];
  const now = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  for (let i = 0; i < 9; i++) {
    const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayNames[date.getDay()];
    
    const conditions = getDayConditions(dateStr, marine, weather);
    if (!conditions) continue;
    
    const tideRange = tides.get(dateStr) || { low: 1.5, high: 5.0 };
    
    // Use mid-tide for scoring (average of high and low)
    const avgTide = (tideRange.low + tideRange.high) / 2;
    
    const breakdown = calculateSurfScoreWithBreakdown({
      waveHeight: conditions.waveHeight,
      wavePeriod: conditions.wavePeriod,
      waveDirection: conditions.waveDirection,
      windSpeed: conditions.windSpeed,
      windDirection: conditions.windDirection,
      tideHeight: avgTide,
      tideRising: true, // Assume best case
    });
    
    forecasts.push({
      date: dateStr,
      dayName,
      waveHeight: conditions.waveHeight,
      wavePeriod: conditions.wavePeriod,
      waveDirection: conditions.waveDirection,
      windSpeed: conditions.windSpeed,
      windDirection: conditions.windDirection,
      tideRange,
      score: breakdown.total,
      rating: getSurfRating(breakdown.total),
      colorClass: getRatingColor(breakdown.total),
      breakdown,
    });
  }
  
  return forecasts;
}
