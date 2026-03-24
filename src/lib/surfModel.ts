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
