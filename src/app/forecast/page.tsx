import { fetchBlendedConditions } from '@/lib/buoys';
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
  return (windDir >= 250 && windDir <= 350) || windDir <= 20;
}

export default async function ForecastPage() {
  const conditions = await fetchBlendedConditions();

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
        {/* Score Hero */}
        <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-8 mb-8 text-center">
          <h1 className="text-zinc-400 text-lg mb-2">13th Street / The Washout</h1>
          <div className={`text-8xl font-bold mb-2 ${colorClass}`}>{score}</div>
          <div className={`text-3xl font-semibold ${colorClass}`}>{rating}</div>
          
          {/* Score Notes */}
          {breakdown.notes.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {breakdown.notes.map((note, i) => (
                <span key={i} className="text-sm bg-zinc-700 px-3 py-1 rounded-full">
                  {note}
                </span>
              ))}
            </div>
          )}
          
          <p className="text-zinc-500 mt-4 text-sm">
            Updated {new Date(conditions.timestamp).toLocaleTimeString()}
          </p>
        </div>

        {/* Score Breakdown */}
        <div className="bg-zinc-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Score Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${breakdown.factors.height.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {breakdown.factors.height.score > 0 ? '+' : ''}{breakdown.factors.height.score}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Height</div>
              <div className="text-xs text-zinc-500">{breakdown.factors.height.note}</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${breakdown.factors.period.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {breakdown.factors.period.score > 0 ? '+' : ''}{breakdown.factors.period.score}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Period</div>
              <div className="text-xs text-zinc-500">{breakdown.factors.period.note}</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${breakdown.factors.tide.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {breakdown.factors.tide.score > 0 ? '+' : ''}{breakdown.factors.tide.score}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Tide</div>
              <div className="text-xs text-zinc-500">{breakdown.factors.tide.note}</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${breakdown.factors.wind.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {breakdown.factors.wind.score > 0 ? '+' : ''}{breakdown.factors.wind.score}
              </div>
              <div className="text-xs text-zinc-400 mt-1">Wind</div>
              <div className="text-xs text-zinc-500">{breakdown.factors.wind.note}</div>
            </div>
          </div>
        </div>

        {/* Conditions Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Waves */}
          <div className="bg-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🌊 Waves
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-400">Height</span>
                <span className="font-mono text-xl">{conditions.waveHeight} ft</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Period</span>
                <span className="font-mono text-xl">{conditions.wavePeriod}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Direction</span>
                <span className="font-mono">
                  {degreeToCardinal(conditions.waveDirection)} ({conditions.waveDirection}°)
                </span>
              </div>
            </div>
          </div>

          {/* Wind */}
          <div className="bg-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              💨 Wind
              {offshore && (
                <span className="text-xs bg-green-600 px-2 py-0.5 rounded">OFFSHORE</span>
              )}
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-400">Speed</span>
                <span className="font-mono text-xl">{conditions.windSpeed} kn</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Gusts</span>
                <span className="font-mono text-xl">{conditions.windGusts} kn</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Direction</span>
                <span className="font-mono">
                  {degreeToCardinal(conditions.windDirection)} ({conditions.windDirection}°)
                </span>
              </div>
            </div>
          </div>

          {/* Tide */}
          <div className="bg-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🌙 Tide
              <span className={`text-xs px-2 py-0.5 rounded ${
                conditions.tideRising ? 'bg-blue-600' : 'bg-orange-600'
              }`}>
                {conditions.tideRising ? '↑ RISING' : '↓ FALLING'}
              </span>
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-400">Current</span>
                <span className="font-mono text-xl">{conditions.tideHeight.toFixed(1)} ft</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Next {conditions.tideRising ? 'High' : 'Low'}</span>
                <span className="font-mono">{conditions.nextTideExtreme.toFixed(1)} ft</span>
              </div>
            </div>
          </div>

          {/* Water */}
          <div className="bg-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">🌡️ Water</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-400">Temperature</span>
                <span className="font-mono text-xl">{conditions.waterTemp}°F</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Wetsuit</span>
                <span className="font-mono">
                  {conditions.waterTemp >= 75 ? 'Trunks' :
                   conditions.waterTemp >= 68 ? 'Shorty/Spring' :
                   conditions.waterTemp >= 60 ? '3/2mm' :
                   conditions.waterTemp >= 55 ? '4/3mm' : '5/4mm + boots'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Sources */}
        <div className="bg-zinc-800/50 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-zinc-400 mb-3">Data Sources</h3>
          <div className="flex flex-wrap gap-2">
            {conditions.buoysUsed.map(id => (
              <a
                key={id}
                href={`https://www.ndbc.noaa.gov/station_page.php?station=${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded"
              >
                Buoy {id}
              </a>
            ))}
            <a
              href="https://tidesandcurrents.noaa.gov/stationhome.html?id=8665530"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded"
            >
              Charleston Tide
            </a>
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            Confidence: {Math.round(conditions.confidence * 100)}% • 
            Blended from {conditions.buoysUsed.length} buoys
          </p>
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
