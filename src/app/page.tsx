import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Hero */}
      <div className="relative h-[60vh] flex items-center justify-center bg-gradient-to-b from-blue-900 to-zinc-900">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-4">🌊 Folly Surf</h1>
          <p className="text-xl text-zinc-300 mb-8">
            ML-powered surf forecast for 13th Street / The Washout
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/forecast"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold"
            >
              View Forecast
            </Link>
            <Link
              href="/tune"
              className="px-8 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-lg font-semibold"
            >
              Tune Model
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto py-16 px-6">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-zinc-800 rounded-xl p-6">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">13 Features</h3>
            <p className="text-zinc-400">
              Wave height, period, direction, wind, gusts, tide, secondary swell, 
              water temp — all the factors that matter.
            </p>
          </div>

          <div className="bg-zinc-800 rounded-xl p-6">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold mb-2">ML Model</h3>
            <p className="text-zinc-400">
              Gradient boosting trained on synthetic data encoding local knowledge 
              about what makes good waves at Folly.
            </p>
          </div>

          <div className="bg-zinc-800 rounded-xl p-6">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold mb-2">Human Feedback</h3>
            <p className="text-zinc-400">
              Tune the model with real observations. Your feedback refines 
              predictions over time.
            </p>
          </div>
        </div>

        {/* Data Sources */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Data Sources</h2>
          <div className="bg-zinc-800 rounded-xl p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Buoys</h4>
                <ul className="text-zinc-400 space-y-1 text-sm">
                  <li>• 41029 - Capers Nearshore (12nm) - primary</li>
                  <li>• 41004 - Edisto (41nm) - offshore swell</li>
                  <li>• 41008 - Grays Reef (95nm) - south swell</li>
                  <li>• 41013 - Frying Pan (120nm) - north swell</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Other</h4>
                <ul className="text-zinc-400 space-y-1 text-sm">
                  <li>• NOAA Tide Station 8665530 (Charleston)</li>
                  <li>• Open-Meteo Marine API (forecasts)</li>
                  <li>• NWS Wind Forecasts</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="mt-12 flex justify-center gap-6">
          <a 
            href="https://github.com/marc231hab/surf" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-white"
          >
            GitHub →
          </a>
          <Link href="/tune" className="text-zinc-400 hover:text-white">
            Tune Model →
          </Link>
        </div>
      </div>
    </div>
  );
}
