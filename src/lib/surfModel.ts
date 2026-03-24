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

  // === WAVE HEIGHT ===
  // Need at least 2.5ft for good surf, 3ft+ for great
  const h = input.waveHeight;
  let heightScore = 0;
  let heightNote = '';
  
  if (h >= 3.5 && h <= 6) {
    heightScore = 25;
    heightNote = `${h}ft - sweet spot`;
  } else if (h >= 3 && h < 3.5) {
    heightScore = 18;
    heightNote = `${h}ft - good size`;
  } else if (h >= 2.5 && h < 3) {
    heightScore = 10;
    heightNote = `${h}ft - decent`;
  } else if (h >= 2 && h < 2.5) {
    heightScore = -5;
    heightNote = `${h}ft - small`;
    notes.push('Waves small');
  } else if (h >= 1.5 && h < 2) {
    heightScore = -18;
    heightNote = `${h}ft - below 2ft`;
    notes.push('Waves below 2ft');
  } else if (h >= 1 && h < 1.5) {
    heightScore = -28;
    heightNote = `${h}ft - very small`;
    notes.push('Waves too small');
  } else if (h < 1) {
    heightScore = -40;
    heightNote = `${h}ft - flat`;
    notes.push('Basically flat');
  } else if (h > 6 && h <= 8) {
    heightScore = 18;
    heightNote = `${h}ft - solid`;
  } else if (h > 8) {
    heightScore = h > 10 ? -10 : 8;
    heightNote = `${h}ft - ${h > 10 ? 'very big' : 'big'}`;
  }
  total += heightScore;

  // === WAVE PERIOD ===
  // Period is critical for wave quality - short period = choppy/weak
  const p = input.wavePeriod;
  let periodScore = 0;
  let periodNote = '';
  
  if (p >= 10 && p <= 13) {
    periodScore = 22;
    periodNote = `${p}s - ideal for Folly`;
  } else if (p >= 8 && p < 10) {
    periodScore = 10;
    periodNote = `${p}s - good`;
  } else if (p >= 7 && p < 8) {
    periodScore = 0;
    periodNote = `${p}s - okay`;
  } else if (p >= 6 && p < 7) {
    periodScore = -10;
    periodNote = `${p}s - short, choppy`;
    notes.push('Short period');
  } else if (p >= 5 && p < 6) {
    periodScore = -18;
    periodNote = `${p}s - very short`;
    notes.push('Very short period');
  } else if (p < 5) {
    periodScore = -25;
    periodNote = `${p}s - wind chop`;
    notes.push('Wind chop');
  } else if (p > 13 && p <= 15) {
    periodScore = -8;
    periodNote = `${p}s - closes out`;
  } else {
    periodScore = -15;
    periodNote = `${p}s - too long`;
  }
  total += periodScore;

  // === WAVE DIRECTION ===
  // Specific to Folly Beach 13th Street
  const wd = input.waveDirection ?? 170;
  if (wd >= 160 && wd <= 190) {
    total += 15;  // Best direction - S to SSE
  } else if (wd >= 130 && wd < 160) {
    total += 8;   // SSE to SE - okay but can close out
    notes.push('Swell may close out');
  } else if (wd >= 110 && wd < 130) {
    total += 12;  // SE to ESE - can be great
  } else if (wd > 190 && wd <= 200) {
    total += 5;   // S to SSW - okay but shadowed/drifty
    notes.push('Shadowed swell');
  } else if (wd >= 75 && wd < 110) {
    total -= 8;   // ESE to ENE - shadowed by jetties, drifty
    notes.push('Shadowed by jetties');
  } else {
    total -= 20;  // Wrong direction
    notes.push('Poor swell direction');
  }

  // === TIDE HEIGHT ===
  const t = input.tideHeight;
  let tideScore = 0;
  let tideNote = '';
  
  if (t < 0.5) {
    tideScore = -40;
    tideNote = `${t.toFixed(1)}ft - too low`;
    notes.push('Tide too low');
  } else if (t < 1.0) {
    tideScore = -32;
    tideNote = `${t.toFixed(1)}ft - very low`;
    notes.push('Tide very low');
  } else if (t < 1.5) {
    tideScore = -25;
    tideNote = `${t.toFixed(1)}ft - low`;
    notes.push('Low tide');
  } else if (t < 2.0) {
    tideScore = -18;
    tideNote = `${t.toFixed(1)}ft - still low`;
  } else if (t < 2.2) {
    tideScore = -12;
    tideNote = `${t.toFixed(1)}ft - below ideal`;
  } else if (t >= 3.0 && t <= 4.0) {
    tideScore = 12;
    tideNote = `${t.toFixed(1)}ft - sweet spot`;
  } else if (t >= 2.5 && t < 3.0) {
    tideScore = 8;
    tideNote = `${t.toFixed(1)}ft - good`;
  } else if (t >= 2.2 && t < 2.5) {
    tideScore = 4;
    tideNote = `${t.toFixed(1)}ft - decent`;
  } else if (t > 4.0 && t <= 5.0) {
    tideScore = 5;
    tideNote = `${t.toFixed(1)}ft - high but ok`;
  } else if (t > 5.0) {
    tideScore = t > 5.5 ? -8 : -3;
    tideNote = `${t.toFixed(1)}ft - ${t > 5.5 ? 'too high' : 'high'}`;
  }
  
  // Rising vs falling tide - significant impact
  if (input.tideRising) {
    if (t >= 2.0 && t <= 4.5) {
      tideScore += 10;
      tideNote += ' ↑ rising';
    } else {
      tideScore += 5;
      tideNote += ' ↑';
    }
  } else {
    // Falling tide penalty
    if (t < 2.5) {
      tideScore -= 12;
      tideNote += ' ↓ dropping';
      notes.push('Falling tide');
    } else if (t < 3.5) {
      tideScore -= 6;
      tideNote += ' ↓';
    } else {
      tideScore -= 3;
      tideNote += ' ↓';
    }
  }
  total += tideScore;

  // === WIND ===
  const ws = input.windSpeed;
  const offshore = isOffshore(input.windDirection);
  const onshore = isOnshore(input.windDirection);
  const windDir = directionToCardinal(input.windDirection);
  let windScore = 0;
  let windNote = '';

  if (ws <= 3) {
    windScore = 15;
    windNote = `${ws}kn ${windDir} - glassy`;
    notes.push('Glassy conditions');
  } else if (offshore) {
    if (ws <= 7) {
      windScore = 12;
      windNote = `${ws}kn ${windDir} - light offshore`;
      notes.push('Light offshore 🌬️');
    } else if (ws <= 10) {
      windScore = 10;
      windNote = `${ws}kn ${windDir} - offshore`;
    } else if (ws <= 15) {
      windScore = 5;
      windNote = `${ws}kn ${windDir} - moderate offshore`;
    } else if (ws <= 20) {
      windScore = -5;
      windNote = `${ws}kn ${windDir} - strong offshore`;
      notes.push('Strong offshore');
    } else {
      windScore = -20;
      windNote = `${ws}kn ${windDir} - too strong`;
      notes.push('Wind too strong');
    }
  } else if (onshore) {
    if (ws <= 5) {
      windScore = -3;
      windNote = `${ws}kn ${windDir} - light onshore`;
    } else if (ws <= 8) {
      windScore = -8;
      windNote = `${ws}kn ${windDir} - onshore`;
    } else if (ws <= 12) {
      windScore = -14;
      windNote = `${ws}kn ${windDir} - moderate onshore`;
      notes.push('Onshore wind');
    } else if (ws <= 18) {
      windScore = -22;
      windNote = `${ws}kn ${windDir} - strong onshore`;
      notes.push('Strong onshore');
    } else {
      windScore = -30;
      windNote = `${ws}kn ${windDir} - blown out`;
      notes.push('Blown out');
    }
  } else {
    // Cross-shore
    if (ws <= 7) {
      windScore = 5;
      windNote = `${ws}kn ${windDir} - light cross`;
    } else if (ws <= 12) {
      windScore = -5;
      windNote = `${ws}kn ${windDir} - cross`;
    } else {
      windScore = -15;
      windNote = `${ws}kn ${windDir} - strong cross`;
    }
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
