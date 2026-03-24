'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface HourlyForecast {
  time: string;
  hour: number;
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

interface DayForecast {
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
  hourly: HourlyForecast[];
  bestHour: number;
  bestScore: number;
}

interface CurrentConditions {
  waveHeight: number;
  wavePeriod: number;
  waveDirection: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  tideHeight: number;
  tideRising: boolean;
  waterTemp: number;
  timestamp: string;
  buoysUsed: string[];
  confidence: number;
}

function degToCardinal(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", 
                "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function getScoreColor(score: number): string {
  if (score >= 85) return '#4ade80'; // green-400
  if (score >= 70) return '#86efac'; // green-300
  if (score >= 55) return '#fde047'; // yellow-300
  if (score >= 40) return '#fdba74'; // orange-300
  if (score >= 25) return '#fca5a5'; // red-300
  return '#f87171'; // red-400
}

function HourlyGraph({ hourly, selectedHour, onSelectHour }: { 
  hourly: HourlyForecast[]; 
  selectedHour: number | null;
  onSelectHour: (hour: number) => void;
}) {
  const maxScore = 100;
  const graphHeight = 180;
  
  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      <div className="flex items-end gap-1 h-[200px]">
        {hourly.map((h) => {
          const barHeight = (h.score / maxScore) * graphHeight;
          const isSelected = selectedHour === h.hour;
          const hourLabel = h.hour === 12 ? '12p' : h.hour > 12 ? `${h.hour - 12}p` : `${h.hour}a`;
          
          return (
            <button
              key={h.hour}
              onClick={() => onSelectHour(h.hour)}
              className={`flex-1 flex flex-col items-center gap-1 transition-all ${
                isSelected ? 'scale-105' : 'hover:scale-102'
              }`}
            >
              <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                {h.score}
              </span>
              <div
                className={`w-full rounded-t transition-all ${isSelected ? 'ring-2 ring-white' : ''}`}
                style={{
                  height: `${Math.max(barHeight, 4)}px`,
                  backgroundColor: getScoreColor(h.score),
                  opacity: isSelected ? 1 : 0.7,
                }}
              />
              <span className={`text-xs ${isSelected ? 'text-white font-bold' : 'text-zinc-500'}`}>
                {hourLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HourlyDetail({ hour }: { hour: HourlyForecast }) {
  return (
    <div className="bg-zinc-700/50 rounded-xl p-4 mt-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-lg font-bold">
            {hour.hour === 12 ? '12:00 PM' : hour.hour > 12 ? `${hour.hour - 12}:00 PM` : `${hour.hour}:00 AM`}
          </span>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold" style={{ color: getScoreColor(hour.score) }}>
            {hour.score}
          </span>
          <span className="text-sm text-zinc-400 ml-2">{hour.rating}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="bg-zinc-800 rounded-lg p-2">
          <div className="text-zinc-500 text-xs">Waves</div>
          <div className="font-mono">{hour.waveHeight}ft @ {hour.wavePeriod}s</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-2">
          <div className="text-zinc-500 text-xs">Swell Dir</div>
          <div className="font-mono">{degToCardinal(hour.waveDirection)} ({hour.waveDirection}°)</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-2">
          <div className="text-zinc-500 text-xs">Wind</div>
          <div className="font-mono">{hour.windSpeed}kn {degToCardinal(hour.windDirection)}</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-2">
          <div className="text-zinc-500 text-xs">Tide</div>
          <div className="font-mono">{hour.tideHeight}ft {hour.tideRising ? '↑' : '↓'}</div>
        </div>
      </div>
    </div>
  );
}

function DayCard({ day, isSelected, onClick }: { 
  day: DayForecast; 
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-20 rounded-xl p-3 text-center transition-all ${
        isSelected 
          ? 'bg-zinc-700 ring-2 ring-blue-500' 
          : 'bg-zinc-800 hover:bg-zinc-700/80'
      }`}
    >
      <div className="text-xs text-zinc-400">{day.dayName}</div>
      <div 
        className="text-2xl font-bold my-1"
        style={{ color: getScoreColor(day.bestScore) }}
      >
        {day.bestScore}
      </div>
      <div className="text-xs text-zinc-500">{day.waveHeight}ft</div>
    </button>
  );
}

export default function HomePage() {
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [current, setCurrent] = useState<CurrentConditions | null>(null);
  const [currentScore, setCurrentScore] = useState<{ score: number; rating: string } | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [forecastRes, conditionsRes] = await Promise.all([
          fetch('/api/forecast'),
          fetch('/api/conditions'),
        ]);
        
        if (forecastRes.ok) {
          const data = await forecastRes.json();
          setForecast(data);
          // Set initial selected hour to best hour of first day
          if (data.length > 0 && data[0].hourly?.length > 0) {
            setSelectedHour(data[0].bestHour);
          }
        }
        
        if (conditionsRes.ok) {
          const data = await conditionsRes.json();
          setCurrent(data.conditions);
          setCurrentScore({ score: data.score, rating: data.rating });
        }
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  const selectedDayData = forecast[selectedDay];
  const selectedHourData = selectedDayData?.hourly?.find(h => h.hour === selectedHour);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading forecast...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Header */}
      <header className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">🌊 Folly Surf</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/forecast" className="text-zinc-400 hover:text-white">Details</Link>
            <Link href="/tune" className="text-zinc-400 hover:text-white">Tune</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Current Conditions Banner */}
        {current && currentScore && (
          <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wide">Right Now</div>
                <div className="text-sm mt-1">
                  <span className="font-mono">{current.waveHeight}ft @ {current.wavePeriod}s</span>
                  <span className="text-zinc-500 mx-2">•</span>
                  <span className="font-mono">{current.windSpeed}kn {degToCardinal(current.windDirection)}</span>
                  <span className="text-zinc-500 mx-2">•</span>
                  <span className="font-mono">{current.tideHeight.toFixed(1)}ft {current.tideRising ? '↑' : '↓'}</span>
                </div>
              </div>
              <div className="text-right">
                <div 
                  className="text-4xl font-bold"
                  style={{ color: getScoreColor(currentScore.score) }}
                >
                  {currentScore.score}
                </div>
                <div className="text-xs text-zinc-400">{currentScore.rating}</div>
              </div>
            </div>
          </div>
        )}

        {/* Day Selector */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {forecast.map((day, i) => (
              <DayCard
                key={day.date}
                day={day}
                isSelected={selectedDay === i}
                onClick={() => {
                  setSelectedDay(i);
                  setSelectedHour(day.bestHour);
                }}
              />
            ))}
          </div>
        </div>

        {/* Selected Day */}
        {selectedDayData && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">
                {selectedDayData.dayName} 
                <span className="text-zinc-500 font-normal ml-2 text-sm">
                  {new Date(selectedDayData.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </h2>
              <div className="text-sm text-zinc-400">
                Best: <span className="font-bold" style={{ color: getScoreColor(selectedDayData.bestScore) }}>
                  {selectedDayData.bestScore}
                </span> at {selectedDayData.bestHour > 12 ? `${selectedDayData.bestHour - 12}pm` : `${selectedDayData.bestHour}am`}
              </div>
            </div>
            
            {/* Hourly Graph */}
            {selectedDayData.hourly && selectedDayData.hourly.length > 0 && (
              <HourlyGraph 
                hourly={selectedDayData.hourly} 
                selectedHour={selectedHour}
                onSelectHour={setSelectedHour}
              />
            )}
            
            {/* Selected Hour Detail */}
            {selectedHourData && (
              <HourlyDetail hour={selectedHourData} />
            )}
          </div>
        )}

        {/* Quick Summary */}
        <div className="bg-zinc-800/50 rounded-xl p-4 mt-6">
          <h3 className="text-sm font-semibold text-zinc-400 mb-3">Week Overview</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold" style={{ color: getScoreColor(Math.max(...forecast.map(d => d.bestScore))) }}>
                {Math.max(...forecast.map(d => d.bestScore))}
              </div>
              <div className="text-xs text-zinc-500">Best Score</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {forecast.find(d => d.bestScore === Math.max(...forecast.map(d => d.bestScore)))?.dayName}
              </div>
              <div className="text-xs text-zinc-500">Best Day</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {Math.round(forecast.reduce((sum, d) => sum + d.waveHeight, 0) / forecast.length * 10) / 10}ft
              </div>
              <div className="text-xs text-zinc-500">Avg Wave</div>
            </div>
          </div>
        </div>

        {/* Data Attribution */}
        <div className="mt-6 text-center text-xs text-zinc-600">
          13th Street / The Washout • Data: NDBC, NOAA, Open-Meteo
        </div>
      </main>
    </div>
  );
}
