import { fetchBlendedConditions } from '@/lib/buoys';
import { fetch9DayForecast, type DayForecast } from '@/lib/forecast';
import { calculateSurfScoreWithBreakdown, getSurfRating, getRatingColor } from '@/lib/surfModel';
import Link from 'next/link';

export const revalidate = 300; // 5 minutes

function degreeToCardinal(deg: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", 
                      "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

function isOffshore(windDir: number): boolean {
  return (windDir >= 247.5 && windDir <= 360) || (windDir >= 0 && windDir <= 22.5);
}

function ForecastCard({ day }: { day: DayForecast }) {
  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-semibold">{day.dayName}</div>
          <div className="text-xs text-zinc-500">{day.date}</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${day.colorClass}`}>{day.score}</div>
          <div className={`text-xs ${day.colorClass}`}>{day.rating}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-zinc-500">Waves:</span>{' '}
          <span className="font-mono">{day.waveHeight}ft @ {day.wavePeriod}s</span>
        </div>
        <div>
          <span className="text-zinc-500">Dir:</span>{' '}
          <span className="font-mono">{degreeToCardinal(day.waveDirection)} ({day.waveDirection}°)</span>
        </div>
        <div>
          <span className="text-zinc-500">Wind:</span>{' '}
          <span className="font-mono">{day.windSpeed}kn {degreeToCardinal(day.windDirection)}</span>
        </div>
        <div>
          <span className="text-zinc-500">Tide:</span>{' '}
          <span className="font-mono">{day.tideRange.low.toFixed(1)}-{day.tideRange.high.toFixed(1)}ft</span>
        </div>
      </div>
      
      {day.breakdown.notes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {day.breakdown.notes.slice(0, 2).map((note, i) => (
            <span key={i} className="text-xs bg-zinc-700 px-2 py-0.5 rounded">
              {note}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function ForecastPage() {
  const [conditions, forecast] = await Promise.all([
    fetchBlendedConditions(),
    fetch9DayForecast(),
  ]);

  if (!conditions) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Unable to fetch conditions</h1>
          <p className="text-zinc-400">Buoy data may be temporarily unavailable.</p>
          <Link href="/" className="mt-4 inline-block text-blue-400 hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  const breakdown = calculateSurfScoreWithBreakdown({
    waveHeight: conditions.waveHeight,
    wavePeriod: conditions.wavePeriod,
    waveDirection: conditions.waveDirection,
    windSpeed: conditions.windSpeed,
    windDirection: conditions.windDirection,
    windGusts: conditions.windGusts,
    tideHeight: conditions.tideHeight,
    tideRising: conditions.tideRising,
    nextTideExtreme: conditions.nextTideExtreme,
    secondarySwellHeight: conditions.secondarySwellHeight,
    secondarySwellPeriod: conditions.secondarySwellPeriod,
    secondarySwellDirection: conditions.secondarySwellDirection,
    waterTemp: conditions.waterTemp,
  });

  const score = breakdown.total;
  const rating = getSurfRating(score);
  const colorClass = getRatingColor(score);
  const offshore = isOffshore(conditions.windDirection);

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Header */}
      <header className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold">🌊 Folly Surf</Link>
          <nav className="flex gap-4">
            <Link href="/tune" className="text-zinc-400 hover:text-white">Tune</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Current Conditions - Real Time */}
        <div className="mb-8">
          <h2 className="text-sm text-zinc-400 uppercase tracking-wide mb-3">Right Now (Real-Time)</h2>
          
          <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* Score */}
              <div className="text-center md:text-left">
                <div className="text-xs text-zinc-500 mb-1">13th Street / The Washout</div>
                <div className={`text-6xl font-bold ${colorClass}`}>{score}</div>
                <div className={`text-xl ${colorClass}`}>{rating}</div>
              </div>
              
              {/* Breakdown */}
              <div className="flex-1 grid grid-cols-4 gap-3">
                <div className="bg-zinc-700/50 rounded-lg p-2 text-center">
                  <div className={`text-lg font-bold ${breakdown.factors.height.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {breakdown.factors.height.score > 0 ? '+' : ''}{breakdown.factors.height.score}
                  </div>
                  <div className="text-xs text-zinc-400">Height</div>
                </div>
                <div className="bg-zinc-700/50 rounded-lg p-2 text-center">
                  <div className={`text-lg font-bold ${breakdown.factors.period.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {breakdown.factors.period.score > 0 ? '+' : ''}{breakdown.factors.period.score}
                  </div>
                  <div className="text-xs text-zinc-400">Period</div>
                </div>
                <div className="bg-zinc-700/50 rounded-lg p-2 text-center">
                  <div className={`text-lg font-bold ${breakdown.factors.tide.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {breakdown.factors.tide.score > 0 ? '+' : ''}{breakdown.factors.tide.score}
                  </div>
                  <div className="text-xs text-zinc-400">Tide</div>
                </div>
                <div className="bg-zinc-700/50 rounded-lg p-2 text-center">
                  <div className={`text-lg font-bold ${breakdown.factors.wind.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {breakdown.factors.wind.score > 0 ? '+' : ''}{breakdown.factors.wind.score}
                  </div>
                  <div className="text-xs text-zinc-400">Wind</div>
                </div>
              </div>
            </div>
            
            {/* Notes */}
            {breakdown.notes.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {breakdown.notes.map((note, i) => (
                  <span key={i} className="text-sm bg-zinc-700 px-3 py-1 rounded-full">
                    {note}
                  </span>
                ))}
              </div>
            )}
            
            {/* Current Details */}
            <div className="mt-4 pt-4 border-t border-zinc-700 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-zinc-500">Waves:</span>{' '}
                <span className="font-mono">{conditions.waveHeight}ft @ {conditions.wavePeriod}s</span>
              </div>
              <div>
                <span className="text-zinc-500">Direction:</span>{' '}
                <span className="font-mono">{degreeToCardinal(conditions.waveDirection)} ({conditions.waveDirection}°)</span>
              </div>
              <div>
                <span className="text-zinc-500">Wind:</span>{' '}
                <span className="font-mono">{conditions.windSpeed}kn {degreeToCardinal(conditions.windDirection)}</span>
                {offshore && <span className="ml-1 text-green-400 text-xs">offshore</span>}
              </div>
              <div>
                <span className="text-zinc-500">Tide:</span>{' '}
                <span className="font-mono">{conditions.tideHeight.toFixed(1)}ft {conditions.tideRising ? '↑' : '↓'}</span>
              </div>
            </div>
            
            <div className="mt-3 text-xs text-zinc-500">
              Updated {new Date(conditions.timestamp).toLocaleTimeString()} • 
              {conditions.buoysUsed.length} buoys • 
              {Math.round(conditions.confidence * 100)}% confidence
            </div>
          </div>
        </div>

        {/* 9-Day Forecast */}
        <div>
          <h2 className="text-sm text-zinc-400 uppercase tracking-wide mb-3">9-Day Forecast</h2>
          
          {forecast.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forecast.map((day) => (
                <ForecastCard key={day.date} day={day} />
              ))}
            </div>
          ) : (
            <div className="bg-zinc-800 rounded-xl p-6 text-center text-zinc-400">
              Forecast data unavailable
            </div>
          )}
        </div>

        {/* Data Sources */}
        <div className="mt-8 bg-zinc-800/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-400 mb-2">Data Sources</h3>
          <div className="text-xs text-zinc-500">
            <span className="text-zinc-400">Real-time:</span> NDBC Buoys ({conditions.buoysUsed.join(', ')}), NOAA Tide Gauge (8665530)
            <br />
            <span className="text-zinc-400">Forecast:</span> Open-Meteo Marine API, NOAA Tide Predictions
          </div>
        </div>

        {/* Feedback CTA */}
        <div className="mt-8 text-center">
          <p className="text-zinc-500 mb-2">Score seem off?</p>
          <Link
            href="/tune"
            className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
          >
            Help tune the model →
          </Link>
        </div>
      </main>
    </div>
  );
}
