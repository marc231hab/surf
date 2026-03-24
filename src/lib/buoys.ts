/**
 * Multi-buoy data fetching and blending for Folly Beach
 */

import { BUOYS, TIDE_STATION, type BuoyInfo } from './types';

export interface BuoyReading {
  buoyId: string;
  timestamp: string;
  waveHeight: number | null;      // feet
  wavePeriod: number | null;      // seconds (dominant)
  waveDirection: number | null;   // degrees
  windSpeed: number | null;       // knots
  windDirection: number | null;   // degrees
  windGusts: number | null;       // knots
  waterTemp: number | null;       // °F
  // Secondary swell (if available)
  secondaryHeight: number | null;
  secondaryPeriod: number | null;
  secondaryDirection: number | null;
}

export interface TideReading {
  currentHeight: number;
  phase: 'rising' | 'falling';
  nextExtreme: {
    type: 'high' | 'low';
    height: number;
    time: string;
  };
}

export interface BlendedConditions {
  waveHeight: number;
  wavePeriod: number;
  waveDirection: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  tideHeight: number;
  tideRising: boolean;
  nextTideExtreme: number;
  secondarySwellHeight: number;
  secondarySwellPeriod: number;
  secondarySwellDirection: number;
  waterTemp: number;
  // Metadata
  timestamp: string;
  buoysUsed: string[];
  confidence: number;
}

/**
 * Fetch real-time data from a single NDBC buoy
 */
export async function fetchBuoyData(buoyId: string): Promise<BuoyReading | null> {
  try {
    // Fetch standard meteorological data
    const metUrl = `https://www.ndbc.noaa.gov/data/realtime2/${buoyId}.txt`;
    const metRes = await fetch(metUrl, { next: { revalidate: 600 } });
    
    if (!metRes.ok) return null;
    
    const metText = await metRes.text();
    const lines = metText.trim().split('\n');
    
    if (lines.length < 3) return null;
    
    // Parse header and find latest valid reading
    // Format: #YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS PTDY TIDE
    let reading: BuoyReading = {
      buoyId,
      timestamp: new Date().toISOString(),
      waveHeight: null,
      wavePeriod: null,
      waveDirection: null,
      windSpeed: null,
      windDirection: null,
      windGusts: null,
      waterTemp: null,
      secondaryHeight: null,
      secondaryPeriod: null,
      secondaryDirection: null,
    };

    // Find first data line with valid wave data
    for (let i = 2; i < Math.min(lines.length, 15); i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 15) continue;

      const wvht = parseFloat(parts[8]);
      const dpd = parseFloat(parts[9]);
      const mwd = parseFloat(parts[10]);
      const wspd = parseFloat(parts[6]);
      const wdir = parseFloat(parts[5]);
      const gst = parseFloat(parts[7]);
      const wtmp = parseFloat(parts[14]);

      // Check if we have valid wave data (not MM)
      if (!isNaN(wvht) && wvht < 90 && reading.waveHeight === null) {
        reading.waveHeight = Math.round(wvht * 3.281 * 10) / 10; // meters to feet
      }
      if (!isNaN(dpd) && dpd < 90 && reading.wavePeriod === null) {
        reading.wavePeriod = dpd;
      }
      if (!isNaN(mwd) && mwd <= 360 && reading.waveDirection === null) {
        reading.waveDirection = mwd;
      }
      if (!isNaN(wspd) && wspd < 90 && reading.windSpeed === null) {
        reading.windSpeed = Math.round(wspd * 1.944 * 10) / 10; // m/s to knots
      }
      if (!isNaN(wdir) && wdir <= 360 && reading.windDirection === null) {
        reading.windDirection = wdir;
      }
      if (!isNaN(gst) && gst < 90 && reading.windGusts === null) {
        reading.windGusts = Math.round(gst * 1.944 * 10) / 10;
      }
      if (!isNaN(wtmp) && wtmp < 90 && reading.waterTemp === null) {
        reading.waterTemp = Math.round((wtmp * 9/5 + 32) * 10) / 10; // C to F
      }

      // Break if we have all primary data
      if (reading.waveHeight !== null && reading.wavePeriod !== null) break;
    }

    return reading;
  } catch (error) {
    console.error(`Error fetching buoy ${buoyId}:`, error);
    return null;
  }
}

/**
 * Fetch real-time tide data from NOAA
 */
export async function fetchTideData(): Promise<TideReading | null> {
  try {
    // Fetch current water level
    const levelUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${TIDE_STATION}&product=water_level&datum=MLLW&units=english&time_zone=lst_ldt&format=json`;
    
    // Fetch hi/lo predictions
    const now = new Date();
    const startDate = now.toISOString().split('T')[0].replace(/-/g, '');
    const endDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0].replace(/-/g, '');
    const hiloUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${startDate}&end_date=${endDate}&station=${TIDE_STATION}&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&interval=hilo&format=json`;

    const [levelRes, hiloRes] = await Promise.all([
      fetch(levelUrl, { next: { revalidate: 300 } }),
      fetch(hiloUrl, { next: { revalidate: 3600 } }),
    ]);

    if (!levelRes.ok || !hiloRes.ok) return null;

    const levelData = await levelRes.json();
    const hiloData = await hiloRes.json();

    const currentHeight = parseFloat(levelData.data?.[0]?.v);
    if (isNaN(currentHeight)) return null;

    // Find next hi/lo
    const nowStr = now.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).replace(',', '');

    const predictions = hiloData.predictions || [];
    const nextExtreme = predictions.find((p: { t: string }) => p.t > nowStr);
    
    // Determine phase
    const lastHigh = [...predictions].reverse().find((p: { t: string; type: string }) => 
      p.type === 'H' && p.t <= nowStr
    );
    const lastLow = [...predictions].reverse().find((p: { t: string; type: string }) => 
      p.type === 'L' && p.t <= nowStr
    );

    let phase: 'rising' | 'falling' = 'rising';
    if (lastHigh && lastLow) {
      phase = lastHigh.t > lastLow.t ? 'falling' : 'rising';
    }

    return {
      currentHeight,
      phase,
      nextExtreme: nextExtreme ? {
        type: nextExtreme.type === 'H' ? 'high' : 'low',
        height: parseFloat(nextExtreme.v),
        time: nextExtreme.t,
      } : { type: 'high', height: 5, time: '' },
    };
  } catch (error) {
    console.error('Error fetching tide:', error);
    return null;
  }
}

/**
 * Blend data from multiple buoys weighted by distance/relevance
 */
export async function fetchBlendedConditions(): Promise<BlendedConditions | null> {
  try {
    // Fetch all buoys in parallel
    const buoyPromises = BUOYS.map(b => fetchBuoyData(b.id));
    const tidePromise = fetchTideData();

    const [buoyReadings, tide] = await Promise.all([
      Promise.all(buoyPromises),
      tidePromise,
    ]);

    // Filter successful readings
    const validReadings = buoyReadings.filter((r): r is BuoyReading => r !== null);
    
    if (validReadings.length === 0 || !tide) {
      return null;
    }

    // Calculate weighted averages
    let totalWeight = 0;
    let weightedHeight = 0;
    let weightedPeriod = 0;
    let weightedWaveDir = 0;
    let weightedWindSpeed = 0;
    let weightedWindDir = 0;
    let weightedGusts = 0;
    let weightedTemp = 0;
    const buoysUsed: string[] = [];

    for (const reading of validReadings) {
      const buoyInfo = BUOYS.find(b => b.id === reading.buoyId);
      if (!buoyInfo) continue;

      const weight = buoyInfo.weight;
      
      if (reading.waveHeight !== null) {
        weightedHeight += reading.waveHeight * weight;
        totalWeight += weight;
        buoysUsed.push(reading.buoyId);
      }
      if (reading.wavePeriod !== null) {
        weightedPeriod += reading.wavePeriod * weight;
      }
      if (reading.waveDirection !== null) {
        weightedWaveDir += reading.waveDirection * weight;
      }
      if (reading.windSpeed !== null) {
        weightedWindSpeed += reading.windSpeed * weight;
      }
      if (reading.windDirection !== null) {
        weightedWindDir += reading.windDirection * weight;
      }
      if (reading.windGusts !== null) {
        weightedGusts += reading.windGusts * weight;
      }
      if (reading.waterTemp !== null) {
        weightedTemp += reading.waterTemp * weight;
      }
    }

    if (totalWeight === 0) return null;

    // Normalize
    const normalize = (val: number) => Math.round((val / totalWeight) * 10) / 10;

    return {
      waveHeight: normalize(weightedHeight),
      wavePeriod: normalize(weightedPeriod),
      waveDirection: Math.round(weightedWaveDir / totalWeight),
      windSpeed: normalize(weightedWindSpeed),
      windDirection: Math.round(weightedWindDir / totalWeight),
      windGusts: normalize(weightedGusts) || normalize(weightedWindSpeed) + 5,
      tideHeight: tide.currentHeight,
      tideRising: tide.phase === 'rising',
      nextTideExtreme: tide.nextExtreme.height,
      secondarySwellHeight: 0, // TODO: parse from spectral data
      secondarySwellPeriod: 0,
      secondarySwellDirection: 0,
      waterTemp: normalize(weightedTemp) || 70,
      timestamp: new Date().toISOString(),
      buoysUsed,
      confidence: Math.min(1, totalWeight / 0.8), // Max confidence at 80% coverage
    };
  } catch (error) {
    console.error('Error blending conditions:', error);
    return null;
  }
}
