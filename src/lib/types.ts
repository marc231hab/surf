/**
 * Surf Forecasting Types
 * 13 features that influence wave quality at Folly Beach (13th Street)
 */

export interface SurfConditions {
  // Primary swell
  waveHeight: number;           // feet
  wavePeriod: number;           // seconds
  waveDirection: number;        // degrees (0-360, where waves are coming FROM)
  
  // Wind
  windSpeed: number;            // knots
  windDirection: number;        // degrees (0-360, where wind is coming FROM)
  windGusts: number;            // knots
  
  // Tide
  tideHeight: number;           // feet above MLLW
  tideRising: boolean;          // true if tide is rising
  nextTideExtreme: number;      // height of next high/low in feet
  
  // Secondary swell (often present, affects wave shape)
  secondarySwellHeight: number; // feet (0 if none)
  secondarySwellPeriod: number; // seconds (0 if none)
  secondarySwellDirection: number; // degrees (0 if none)
  
  // Water
  waterTemp: number;            // °F
}

export interface SurfScore {
  total: number;                // 0-100 happiness score
  rating: string;               // "Excellent", "Great", "Good", "Fair", "Poor", "Very Poor"
  confidence: number;           // 0-1, how confident we are in this prediction
}

export interface BuoyInfo {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceToFolly: number;      // nautical miles
  weight: number;               // 0-1, contribution to blended forecast
}

export interface FeedbackEntry {
  timestamp: string;
  conditions: SurfConditions;
  predictedScore: number;
  userAdjustment: number;       // -10 to +10
  finalScore: number;
}

// Folly Beach 13th Street coordinates
export const FOLLY_COORDS = {
  lat: 32.655,
  lon: -79.944
};

// Nearby buoys
export const BUOYS: BuoyInfo[] = [
  {
    id: '41004',
    name: 'EDISTO - 41 NM Southeast of Charleston, SC',
    lat: 32.501,
    lon: -79.099,
    distanceToFolly: 41,
    weight: 0.4
  },
  {
    id: '41029',
    name: 'Capers Nearshore, SC',
    lat: 32.810,
    lon: -79.630,
    distanceToFolly: 12,
    weight: 0.35
  },
  {
    id: '41008',
    name: 'Grays Reef - 40 NM Southeast of Savannah, GA',
    lat: 31.402,
    lon: -80.869,
    distanceToFolly: 95,
    weight: 0.15
  },
  {
    id: '41013',
    name: 'Frying Pan Shoals, NC',
    lat: 33.436,
    lon: -77.743,
    distanceToFolly: 120,
    weight: 0.10
  }
];

// Charleston tide station
export const TIDE_STATION = '8665530';
