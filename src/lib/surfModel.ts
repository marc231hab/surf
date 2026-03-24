// Surf model inference with score breakdown
// Based on Marc's preferences for Folly Beach (13th Street)

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
 * Linear interpolation between defined points
 */
function interpolate(value: number, points: [number, number][]): number {
  // Sort points by x value
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  
  // Clamp to range
  if (value <= sorted[0][0]) return sorted[0][1];
  if (value >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
  
  // Find surrounding points and interpolate
  for (let i = 0; i < sorted.length - 1; i++) {
    const [x1, y1] = sorted[i];
    const [x2, y2] = sorted[i + 1];
    if (value >= x1 && value <= x2) {
      const t = (value - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }
  return 0;
}

/**
 * Check if wind is offshore at Folly Beach.
 * Offshore: WSW (247.5°), W (270°), WNW (292.5°), NW (315°), N (0/360°)
 */
function isOffshore(windDir: number): boolean {
  return (windDir >= 247.5 && windDir <= 360) || (windDir >= 0 && windDir <= 22.5);
}

/**
 * Check if wind is onshore at Folly Beach.
 * Onshore: NE (45°), ENE (67.5°), E (90°), ESE (112.5°), SE (135°), S (180°), SW (225°)
 */
function isOnshore(windDir: number): boolean {
  return windDir >= 45 && windDir <= 225;
}

function directionToCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

/**
 * Calculate surf score with detailed breakdown
 */
export function calculateSurfScoreWithBreakdown(input: SurfInput): ScoreBreakdown {
  const notes: string[] = [];
  let total = 50;

  // === WAVE HEIGHT === (smooth curve)
  const h = input.waveHeight;
  // Key points: [height, score]
  const heightCurve: [number, number][] = [
    [0, -35],    // flat
    [1, -22],    // too small
    [1.5, -15],  // very small
    [2, -6],     // small
    [2.5, 8],    // decent
    [3, 15],     // good
    [3.5, 22],   // great
    [5, 25],     // sweet spot peak
    [6, 22],     // still great
    [8, 15],     // big but good
    [10, 5],     // very big
    [12, -10],   // too big
  ];
  const heightScore = Math.round(interpolate(h, heightCurve));
  
  let heightNote = '';
  if (h < 1) { heightNote = `${h}ft - flat`; notes.push('Basically flat'); }
  else if (h < 1.5) { heightNote = `${h}ft - too small`; notes.push('Waves too small'); }
  else if (h < 2) { heightNote = `${h}ft - small`; notes.push('Waves small'); }
  else if (h < 2.5) { heightNote = `${h}ft - smallish`; }
  else if (h < 3) { heightNote = `${h}ft - decent`; }
  else if (h < 4) { heightNote = `${h}ft - good`; }
  else if (h <= 6) { heightNote = `${h}ft - sweet spot`; }
  else if (h <= 8) { heightNote = `${h}ft - solid`; }
  else { heightNote = `${h}ft - big`; }
  
  total += heightScore;

  // === WAVE PERIOD === (smooth curve)
  const p = input.wavePeriod;
  const periodCurve: [number, number][] = [
    [3, -30],    // wind chop
    [5, -20],    // very short
    [6, -12],    // short
    [7, -2],     // okay
    [8, 8],      // good
    [10, 18],    // great
    [12, 22],    // ideal peak
    [13, 18],    // still great
    [14, 5],     // starting to close out
    [15, -5],    // closes out
    [17, -15],   // too long
  ];
  const periodScore = Math.round(interpolate(p, periodCurve));
  
  let periodNote = '';
  if (p < 5) { periodNote = `${p}s - wind chop`; notes.push('Wind chop'); }
  else if (p < 6) { periodNote = `${p}s - very short`; notes.push('Short period'); }
  else if (p < 7) { periodNote = `${p}s - short`; }
  else if (p < 8) { periodNote = `${p}s - okay`; }
  else if (p < 10) { periodNote = `${p}s - good`; }
  else if (p <= 13) { periodNote = `${p}s - ideal`; }
  else if (p <= 15) { periodNote = `${p}s - closes out`; }
  else { periodNote = `${p}s - too long`; }
  
  total += periodScore;

  // === WAVE DIRECTION === (smooth curve for Folly Beach)
  const wd = input.waveDirection ?? 170;
  // Folly faces ESE (~110°), best swells from S-SSE (160-190°)
  const dirCurve: [number, number][] = [
    [0, -20],    // N - offshore, doesn't work
    [45, -18],   // NE - wrong angle
    [75, -8],    // ENE - jetty shadow starts
    [90, -6],    // E - shadowed
    [110, 8],    // ESE - can be great
    [130, 10],   // SE - good
    [150, 12],   // SSE - very good
    [175, 15],   // S - ideal
    [190, 12],   // SSW - still good
    [200, 5],    // SW - shadowed/drifty
    [220, -5],   // WSW - not great
    [250, -15],  // W - offshore direction
    [300, -20],  // NW - wrong
    [360, -20],  // N - wrong
  ];
  const dirScore = Math.round(interpolate(wd, dirCurve));
  total += dirScore;
  
  if (wd >= 75 && wd < 110) notes.push('Jetty shadow');
  else if (wd > 200 && wd < 250) notes.push('Shadowed swell');
  else if (wd < 75 || wd >= 250) notes.push('Poor swell angle');

  // === TIDE HEIGHT === (smooth curve)
  const t = input.tideHeight;
  const tideCurve: [number, number][] = [
    [0, -40],    // too low
    [0.5, -30],  // very low
    [1, -20],    // low
    [1.5, -12],  // still low
    [2, -4],     // below ideal
    [2.5, 6],    // decent
    [3, 12],     // good
    [3.5, 14],   // sweet spot
    [4, 12],     // still good
    [4.5, 6],    // getting high
    [5, 0],      // high
    [5.5, -6],   // too high
    [6, -12],    // way too high
  ];
  let tideScore = Math.round(interpolate(t, tideCurve));
  
  let tideNote = '';
  if (t < 0.5) { tideNote = `${t.toFixed(1)}ft - too low`; notes.push('Tide too low'); }
  else if (t < 1) { tideNote = `${t.toFixed(1)}ft - very low`; notes.push('Tide very low'); }
  else if (t < 1.5) { tideNote = `${t.toFixed(1)}ft - low`; notes.push('Low tide'); }
  else if (t < 2) { tideNote = `${t.toFixed(1)}ft - still low`; }
  else if (t < 2.5) { tideNote = `${t.toFixed(1)}ft - below ideal`; }
  else if (t < 3) { tideNote = `${t.toFixed(1)}ft - decent`; }
  else if (t <= 4) { tideNote = `${t.toFixed(1)}ft - sweet spot`; }
  else if (t <= 5) { tideNote = `${t.toFixed(1)}ft - high`; }
  else { tideNote = `${t.toFixed(1)}ft - too high`; }
  
  // Rising vs falling tide modifier (also smooth)
  const risingBonus = input.tideRising ? 8 : -6;
  // Bonus/penalty is stronger in the good tide range
  const tideRangeFactor = (t >= 2 && t <= 4.5) ? 1 : 0.5;
  tideScore += Math.round(risingBonus * tideRangeFactor);
  tideNote += input.tideRising ? ' ↑' : ' ↓';
  if (!input.tideRising && t < 2.5) notes.push('Falling tide');
  
  total += tideScore;

  // === WIND === (smooth curves based on direction)
  const ws = input.windSpeed;
  const offshore = isOffshore(input.windDirection);
  const onshore = isOnshore(input.windDirection);
  const windDir = directionToCardinal(input.windDirection);
  
  // Different curves for offshore vs onshore vs cross
  const offshoreCurve: [number, number][] = [
    [0, 15],    // glassy
    [5, 14],    // light offshore - great
    [10, 10],   // moderate offshore - good
    [15, 3],    // stronger offshore
    [20, -8],   // too strong
    [25, -20],  // way too strong
  ];
  const onshoreCurve: [number, number][] = [
    [0, 15],    // glassy (no direction matters)
    [3, 8],     // barely onshore
    [6, -2],    // light onshore
    [10, -12],  // moderate onshore
    [15, -22],  // strong onshore
    [20, -30],  // blown out
  ];
  const crossCurve: [number, number][] = [
    [0, 15],    // glassy
    [5, 8],     // light cross
    [10, 0],    // moderate cross
    [15, -10],  // strong cross
    [20, -20],  // too strong
  ];
  
  let windScore: number;
  if (ws <= 3) {
    windScore = 15; // glassy - direction doesn't matter
  } else if (offshore) {
    windScore = Math.round(interpolate(ws, offshoreCurve));
  } else if (onshore) {
    windScore = Math.round(interpolate(ws, onshoreCurve));
  } else {
    windScore = Math.round(interpolate(ws, crossCurve));
  }
  
  let windNote = '';
  if (ws <= 3) { windNote = `${ws}kn ${windDir} - glassy`; notes.push('Glassy'); }
  else if (offshore) {
    if (ws <= 8) { windNote = `${ws}kn ${windDir} - light offshore`; notes.push('Offshore 🌬️'); }
    else if (ws <= 15) { windNote = `${ws}kn ${windDir} - offshore`; }
    else { windNote = `${ws}kn ${windDir} - strong offshore`; notes.push('Strong offshore'); }
  } else if (onshore) {
    if (ws <= 8) { windNote = `${ws}kn ${windDir} - light onshore`; }
    else if (ws <= 15) { windNote = `${ws}kn ${windDir} - onshore`; notes.push('Onshore'); }
    else { windNote = `${ws}kn ${windDir} - blown out`; notes.push('Blown out'); }
  } else {
    if (ws <= 10) { windNote = `${ws}kn ${windDir} - light cross`; }
    else { windNote = `${ws}kn ${windDir} - cross`; }
  }

  // Gust penalty
  const gusts = input.windGusts ?? ws;
  if (gusts - ws > 10) {
    windScore -= 10;
    windNote += ' (gusty)';
  } else if (gusts - ws > 5) {
    windScore -= 5;
  }
  total += windScore;

  // === INTERACTION PENALTIES ===
  // Small waves + short period = not worth it
  if (h < 2.5 && p < 7) {
    total -= 10;
    notes.push('Small + short period');
  }
  if (t < 2.2 && h < 2.5) {
    total -= 10;
    notes.push('Low tide + small waves');
  }
  if (p < 6 && onshore && ws > 10) {
    total -= 8;
    notes.push('Choppy + onshore');
  }
  // Good conditions bonus only when waves are actually rideable
  if (offshore && ws <= 10 && h >= 2.5 && p >= 7) {
    total += 5;
  }
  
  // Floor: decent waves (3ft+) should never be "Very Poor"
  if (h >= 3 && total < 20) {
    total = 20;
  }

  return {
    total: Math.max(0, Math.min(100, Math.round(total))),
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
 * Simple score calculation (for compatibility)
 */
export function calculateSurfScore(input: SurfInput): number {
  return calculateSurfScoreWithBreakdown(input).total;
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
