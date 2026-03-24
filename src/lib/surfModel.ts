// Surf model inference - placeholder until model is trained

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

/**
 * Temporary scoring function until ML model is trained.
 * Uses simple heuristics matching the synthetic data labeling logic.
 */
export function calculateSurfScore(input: SurfInput): number {
  let score = 50;

  // Wave height
  const h = input.waveHeight;
  if (h >= 3 && h <= 6) score += 25;
  else if (h >= 2 && h < 3) score += 12;
  else if (h >= 1.5 && h < 2) score -= 5;
  else if (h < 1.5) score -= 30;
  else if (h > 6 && h <= 8) score += 18;
  else if (h > 8 && h <= 10) score += 8;
  else if (h > 10) score -= 10;

  // Wave period
  const p = input.wavePeriod;
  if (p >= 10 && p <= 13) score += 22;
  else if (p >= 8 && p < 10) score += 12;
  else if (p >= 7 && p < 8) score += 5;
  else if (p >= 6 && p < 7) score -= 5;
  else if (p < 6) score -= 18;
  else if (p > 13 && p <= 15) score -= 8;
  else if (p > 15) score -= 15;

  // Tide height (3.5ft optimal)
  const t = input.tideHeight;
  if (t < 0.5) score -= 35;
  else if (t < 1.0) score -= 25;
  else if (t < 1.5) score -= 15;
  else if (t < 2.0) score -= 5;
  else if (t >= 3.0 && t <= 4.0) score += 12;
  else if (t >= 2.5 && t < 3.0) score += 8;
  else if (t >= 2.0 && t < 2.5) score += 4;
  else if (t > 4.0 && t <= 5.0) score += 5;
  else if (t > 5.0 && t <= 5.5) score -= 3;
  else if (t > 5.5) score -= 8;

  // Tide rising bonus
  if (input.tideRising && t >= 1.5 && t <= 4.5) score += 6;

  // Wind (offshore is W to NW: 250-350)
  const wd = input.windDirection;
  const offshore = (wd >= 250 && wd <= 350) || wd <= 20;
  const ws = input.windSpeed;

  if (ws <= 5) score += 15;
  else if (ws <= 8) score += 10;
  else if (ws <= 12) {
    if (offshore) score += 8;
    else score -= 5;
  } else if (ws <= 15) {
    if (offshore) score += 2;
    else score -= 12;
  } else if (ws <= 20) {
    if (offshore) score -= 5;
    else score -= 20;
  } else {
    score -= 30;
  }

  // Gust penalty
  const gusts = input.windGusts ?? ws;
  if (gusts - ws > 10) score -= 8;
  else if (gusts - ws > 5) score -= 4;

  // Interactions
  if (h < 3 && h >= 1.5 && p >= 11) score += 10;
  if (t < 1.5 && h < 2.5) score -= 15;
  if (offshore && (h < 3 || t < 2)) score += 6;
  if (h >= 5 && t >= 3 && t <= 4.5) score += 5;
  if (p > 12 && t < 2) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getSurfRating(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Great";
  if (score >= 55) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 25) return "Poor";
  return "Very Poor";
}

export function getRatingColor(score: number): string {
  if (score >= 85) return "text-green-400";
  if (score >= 70) return "text-green-300";
  if (score >= 55) return "text-yellow-300";
  if (score >= 40) return "text-orange-300";
  if (score >= 25) return "text-red-300";
  return "text-red-400";
}
