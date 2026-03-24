// Auto-generated surf model inference
// Trained on synthetic data for Folly Beach (13th Street)

import lookupData from '../data/model_lookup.json';

export interface SurfInput {
  waveHeight: number;
  wavePeriod: number;
  waveDirection?: number;
  windSpeed: number;
  windDirection: number;
  windGusts?: number;
  tideHeight: number;
  tideRising: boolean;
  nextTideExtreme?: number;
  secondarySwellHeight?: number;
  secondarySwellPeriod?: number;
  secondarySwellDirection?: number;
  waterTemp?: number;
}

interface LookupData {
  grids: Record<string, number[]>;
  defaults: Record<string, number>;
  scores: Record<string, number>;
}

const lookup = lookupData as LookupData;

/**
 * Find the nearest index in a sorted array
 */
function findNearestIndex(arr: number[], val: number): number {
  if (val <= arr[0]) return 0;
  if (val >= arr[arr.length - 1]) return arr.length - 1;
  
  let best = 0;
  let bestDist = Math.abs(arr[0] - val);
  
  for (let i = 1; i < arr.length; i++) {
    const dist = Math.abs(arr[i] - val);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  
  return best;
}

/**
 * Calculate surf score using lookup table with nearest-neighbor lookup
 */
export function calculateSurfScore(input: SurfInput): number {
  // Find nearest grid points
  const h = lookup.grids.wave_height[findNearestIndex(lookup.grids.wave_height, input.waveHeight)];
  const p = lookup.grids.wave_period[findNearestIndex(lookup.grids.wave_period, input.wavePeriod)];
  const t = lookup.grids.tide_height[findNearestIndex(lookup.grids.tide_height, input.tideHeight)];
  const ws = lookup.grids.wind_speed[findNearestIndex(lookup.grids.wind_speed, input.windSpeed)];
  const wd = lookup.grids.wind_direction[findNearestIndex(lookup.grids.wind_direction, input.windDirection)];
  const tr = input.tideRising ? 1 : 0;
  
  // Build key
  const key = `${h}_${p}_${t}_${ws}_${wd}_${tr}`;
  
  // Lookup
  const score = lookup.scores[key];
  
  if (score === undefined) {
    console.warn('Lookup miss for key:', key);
    return 50; // Default neutral
  }
  
  return score;
}

export interface ScoreBreakdown {
  total: number;
  factors: {
    height: { score: number; note: string };
    period: { score: number; note: string };
    tide: { score: number; note: string };
    wind: { score: number; note: string };
  };
  notes: string[];
}

/**
 * Get score breakdown with notes (for UI display)
 * Uses ML model for total score, adds heuristic notes
 */
export function calculateSurfScoreWithBreakdown(input: SurfInput): ScoreBreakdown {
  const total = calculateSurfScore(input);
  const notes: string[] = [];
  
  // Height assessment
  const h = input.waveHeight;
  let heightNote = '';
  let heightScore = 0;
  if (h < 1) { heightNote = `${h}ft - flat`; notes.push('Flat'); heightScore = -35; }
  else if (h < 1.5) { heightNote = `${h}ft - too small`; notes.push('Too small'); heightScore = -20; }
  else if (h < 2) { heightNote = `${h}ft - small`; heightScore = -10; }
  else if (h < 2.5) { heightNote = `${h}ft - smallish`; heightScore = 0; }
  else if (h < 3) { heightNote = `${h}ft - decent`; heightScore = 8; }
  else if (h <= 6) { heightNote = `${h}ft - good`; heightScore = 20; }
  else if (h <= 8) { heightNote = `${h}ft - solid`; heightScore = 15; }
  else { heightNote = `${h}ft - big`; heightScore = 5; }
  
  // Period assessment
  const p = input.wavePeriod;
  let periodNote = '';
  let periodScore = 0;
  if (p < 5) { periodNote = `${p}s - wind chop`; notes.push('Wind chop'); periodScore = -25; }
  else if (p < 6) { periodNote = `${p}s - very short`; notes.push('Short period'); periodScore = -15; }
  else if (p < 7) { periodNote = `${p}s - short`; periodScore = -8; }
  else if (p < 8) { periodNote = `${p}s - okay`; periodScore = 0; }
  else if (p < 10) { periodNote = `${p}s - good`; periodScore = 10; }
  else if (p <= 13) { periodNote = `${p}s - ideal`; periodScore = 20; }
  else { periodNote = `${p}s - closes out`; periodScore = -5; }
  
  // Tide assessment
  const t = input.tideHeight;
  let tideNote = '';
  let tideScore = 0;
  if (t < 1) { tideNote = `${t.toFixed(1)}ft - too low`; notes.push('Tide too low'); tideScore = -30; }
  else if (t < 2) { tideNote = `${t.toFixed(1)}ft - low`; notes.push('Low tide'); tideScore = -15; }
  else if (t < 2.5) { tideNote = `${t.toFixed(1)}ft - below ideal`; tideScore = -5; }
  else if (t <= 4) { tideNote = `${t.toFixed(1)}ft - good`; tideScore = 12; }
  else if (t <= 5) { tideNote = `${t.toFixed(1)}ft - high`; tideScore = 0; }
  else { tideNote = `${t.toFixed(1)}ft - too high`; tideScore = -8; }
  tideNote += input.tideRising ? ' ↑' : ' ↓';
  if (!input.tideRising && t < 2.5) notes.push('Falling tide');
  
  // Wind assessment
  const ws = input.windSpeed;
  const wd = input.windDirection;
  const offshore = (wd >= 247.5 && wd <= 360) || (wd >= 0 && wd <= 22.5);
  const onshore = wd >= 45 && wd <= 225;
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const windDir = dirs[Math.round(wd / 22.5) % 16];
  
  let windNote = '';
  let windScore = 0;
  if (ws <= 3) { windNote = `${ws}kn ${windDir} - glassy`; notes.push('Glassy'); windScore = 15; }
  else if (offshore) {
    if (ws <= 10) { windNote = `${ws}kn ${windDir} - offshore`; notes.push('Offshore'); windScore = 12; }
    else { windNote = `${ws}kn ${windDir} - strong offshore`; windScore = 0; }
  } else if (onshore) {
    if (ws <= 8) { windNote = `${ws}kn ${windDir} - onshore`; windScore = -5; }
    else { windNote = `${ws}kn ${windDir} - blown out`; notes.push('Onshore'); windScore = -20; }
  } else {
    windNote = `${ws}kn ${windDir} - cross`; windScore = ws <= 10 ? 5 : -10;
  }
  
  return {
    total,
    factors: {
      height: { score: heightScore, note: heightNote },
      period: { score: periodScore, note: periodNote },
      tide: { score: tideScore, note: tideNote },
      wind: { score: windScore, note: windNote },
    },
    notes: notes.slice(0, 4),
  };
}

/**
 * Get rating string from score
 */
export function getSurfRating(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Great";
  if (score >= 55) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 25) return "Poor";
  return "Very Poor";
}

/**
 * Get rating color
 */
export function getRatingColor(score: number): string {
  if (score >= 85) return "text-green-400";
  if (score >= 70) return "text-green-300";
  if (score >= 55) return "text-yellow-300";
  if (score >= 40) return "text-orange-300";
  if (score >= 25) return "text-red-300";
  return "text-red-400";
}
