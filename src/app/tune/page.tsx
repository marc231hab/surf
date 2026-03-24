'use client';

import { useState, useCallback } from 'react';
import { calculateSurfScore, getSurfRating, getRatingColor } from '@/lib/surfModel';

interface FeatureConfig {
  name: string;
  key: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  default: number;
}

const FEATURES: FeatureConfig[] = [
  { name: 'Wave Height', key: 'waveHeight', min: 0, max: 15, step: 0.5, unit: 'ft', default: 3 },
  { name: 'Wave Period', key: 'wavePeriod', min: 4, max: 18, step: 1, unit: 's', default: 10 },
  { name: 'Wave Direction', key: 'waveDirection', min: 0, max: 360, step: 15, unit: '°', default: 75 },
  { name: 'Wind Speed', key: 'windSpeed', min: 0, max: 35, step: 1, unit: 'kn', default: 8 },
  { name: 'Wind Direction', key: 'windDirection', min: 0, max: 360, step: 15, unit: '°', default: 270 },
  { name: 'Wind Gusts', key: 'windGusts', min: 0, max: 45, step: 1, unit: 'kn', default: 12 },
  { name: 'Tide Height', key: 'tideHeight', min: -0.5, max: 6.5, step: 0.25, unit: 'ft', default: 3 },
  { name: 'Tide Rising', key: 'tideRising', min: 0, max: 1, step: 1, unit: '', default: 1 },
  { name: 'Water Temp', key: 'waterTemp', min: 45, max: 90, step: 1, unit: '°F', default: 70 },
];

function FeatureDial({ 
  config, 
  value, 
  onChange 
}: { 
  config: FeatureConfig; 
  value: number; 
  onChange: (val: number) => void;
}) {
  // Special handling for boolean tide rising
  if (config.key === 'tideRising') {
    return (
      <div className="bg-zinc-800 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm text-zinc-400">{config.name}</label>
          <span className="text-lg font-mono text-white">
            {value ? 'Rising' : 'Falling'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onChange(0)}
            className={`flex-1 py-2 rounded ${!value ? 'bg-blue-600' : 'bg-zinc-700'}`}
          >
            Falling
          </button>
          <button
            onClick={() => onChange(1)}
            className={`flex-1 py-2 rounded ${value ? 'bg-blue-600' : 'bg-zinc-700'}`}
          >
            Rising
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm text-zinc-400">{config.name}</label>
        <span className="text-lg font-mono text-white">
          {value}{config.unit}
        </span>
      </div>
      <input
        type="range"
        min={config.min}
        max={config.max}
        step={config.step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
      <div className="flex justify-between text-xs text-zinc-500 mt-1">
        <span>{config.min}{config.unit}</span>
        <span>{config.max}{config.unit}</span>
      </div>
    </div>
  );
}

function WindDirectionCompass({ value, onChange }: { value: number; onChange: (val: number) => void }) {
  const directions = [
    { label: 'N', deg: 0 },
    { label: 'NE', deg: 45 },
    { label: 'E', deg: 90 },
    { label: 'SE', deg: 135 },
    { label: 'S', deg: 180 },
    { label: 'SW', deg: 225 },
    { label: 'W', deg: 270 },
    { label: 'NW', deg: 315 },
  ];

  return (
    <div className="bg-zinc-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <label className="text-sm text-zinc-400">Wind Direction</label>
        <span className="text-lg font-mono text-white">{value}°</span>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {directions.map((d) => (
          <button
            key={d.deg}
            onClick={() => onChange(d.deg)}
            className={`py-2 rounded text-sm ${
              Math.abs(value - d.deg) < 23 || (d.deg === 0 && value > 337)
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-700 text-zinc-300'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TunePage() {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    FEATURES.forEach((f) => {
      initial[f.key] = f.default;
    });
    return initial;
  });

  const [feedback, setFeedback] = useState<{ adjustment: number; submitted: boolean }>({
    adjustment: 0,
    submitted: false,
  });

  const updateValue = useCallback((key: string, val: number) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setFeedback({ adjustment: 0, submitted: false });
  }, []);

  // Calculate score
  const score = calculateSurfScore({
    waveHeight: values.waveHeight,
    wavePeriod: values.wavePeriod,
    waveDirection: values.waveDirection,
    windSpeed: values.windSpeed,
    windDirection: values.windDirection,
    windGusts: values.windGusts,
    tideHeight: values.tideHeight,
    tideRising: values.tideRising === 1,
    waterTemp: values.waterTemp,
  });

  const rating = getSurfRating(score);
  const colorClass = getRatingColor(score);

  const handleFeedback = async (delta: number) => {
    const newAdjustment = Math.max(-20, Math.min(20, feedback.adjustment + delta));
    setFeedback({ adjustment: newAdjustment, submitted: false });
  };

  const submitFeedback = async () => {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditions: values,
          predictedScore: score,
          adjustment: feedback.adjustment,
          finalScore: Math.max(0, Math.min(100, score + feedback.adjustment)),
        }),
      });
      setFeedback({ ...feedback, submitted: true });
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🏄 Surf Model Tuning</h1>
        <p className="text-zinc-400 mb-8">
          Adjust conditions to see predicted score. Use +/- to provide feedback.
        </p>

        {/* Score Display */}
        <div className="bg-zinc-800 rounded-xl p-6 mb-8 text-center">
          <div className={`text-7xl font-bold mb-2 ${colorClass}`}>{score}</div>
          <div className={`text-2xl ${colorClass}`}>{rating}</div>
          
          {/* Feedback Controls */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={() => handleFeedback(-5)}
              className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 text-2xl font-bold"
            >
              -
            </button>
            <div className="text-center">
              <div className="text-sm text-zinc-400">Adjustment</div>
              <div className={`text-2xl font-mono ${feedback.adjustment > 0 ? 'text-green-400' : feedback.adjustment < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                {feedback.adjustment > 0 ? '+' : ''}{feedback.adjustment}
              </div>
            </div>
            <button
              onClick={() => handleFeedback(5)}
              className="w-12 h-12 rounded-full bg-green-600 hover:bg-green-500 text-2xl font-bold"
            >
              +
            </button>
          </div>

          {feedback.adjustment !== 0 && !feedback.submitted && (
            <button
              onClick={submitFeedback}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
            >
              Submit Feedback (Final: {Math.max(0, Math.min(100, score + feedback.adjustment))})
            </button>
          )}

          {feedback.submitted && (
            <div className="mt-4 text-green-400">✓ Feedback recorded</div>
          )}
        </div>

        {/* Feature Dials */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.filter(f => f.key !== 'windDirection').map((config) => (
            <FeatureDial
              key={config.key}
              config={config}
              value={values[config.key]}
              onChange={(val) => updateValue(config.key, val)}
            />
          ))}
          <WindDirectionCompass
            value={values.windDirection}
            onChange={(val) => updateValue('windDirection', val)}
          />
        </div>

        {/* Conditions Summary */}
        <div className="mt-8 bg-zinc-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Current Conditions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-zinc-400">Waves:</span>{' '}
              {values.waveHeight}ft @ {values.wavePeriod}s
            </div>
            <div>
              <span className="text-zinc-400">Wind:</span>{' '}
              {values.windSpeed}kn ({values.windDirection}°)
            </div>
            <div>
              <span className="text-zinc-400">Tide:</span>{' '}
              {values.tideHeight}ft {values.tideRising ? '↑' : '↓'}
            </div>
            <div>
              <span className="text-zinc-400">Water:</span>{' '}
              {values.waterTemp}°F
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
