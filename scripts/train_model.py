#!/usr/bin/env python3
"""
Train Gradient Boosting model on synthetic surf data.
Exports a lookup table for TypeScript inference.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import json
from pathlib import Path

FEATURES = [
    'wave_height',
    'wave_period',
    'wave_direction',
    'wind_speed',
    'wind_direction',
    'wind_gusts',
    'tide_height',
    'tide_rising',
    'next_tide_extreme',
    'secondary_swell_height',
    'secondary_swell_period',
    'secondary_swell_direction',
    'water_temp'
]


def load_data():
    """Load synthetic training data."""
    data_path = Path(__file__).parent.parent / 'data' / 'synthetic_surf_data.csv'
    df = pd.read_csv(data_path)
    
    # Convert boolean to int
    df['tide_rising'] = df['tide_rising'].astype(int)
    
    return df


def train_model(df):
    """Train gradient boosting model."""
    X = df[FEATURES].values
    y = df['score'].values
    
    # Split for validation
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Train
    model = GradientBoostingRegressor(
        n_estimators=150,
        max_depth=5,
        learning_rate=0.1,
        min_samples_leaf=10,
        random_state=42
    )
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)
    
    print("Model Performance:")
    print(f"  Train MAE: {mean_absolute_error(y_train, y_pred_train):.2f}")
    print(f"  Test MAE: {mean_absolute_error(y_test, y_pred_test):.2f}")
    print(f"  Train R²: {r2_score(y_train, y_pred_train):.3f}")
    print(f"  Test R²: {r2_score(y_test, y_pred_test):.3f}")
    
    # Feature importance
    print("\nFeature Importance:")
    importance = list(zip(FEATURES, model.feature_importances_))
    importance.sort(key=lambda x: x[1], reverse=True)
    for feat, imp in importance:
        print(f"  {feat}: {imp:.3f}")
    
    return model


def export_lookup_table(model, output_path):
    """
    Export precomputed lookup table for TypeScript.
    Uses a coarse grid with interpolation at runtime.
    """
    # Define grid points for each feature
    grids = {
        'wave_height': [0, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12],
        'wave_period': [4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18],
        'wave_direction': [30, 60, 75, 90, 120, 150],
        'wind_speed': [0, 5, 8, 10, 12, 15, 20, 25, 30],
        'wind_direction': [0, 45, 90, 135, 180, 225, 270, 315],
        'wind_gusts': [0, 8, 12, 16, 20, 25, 30, 35],
        'tide_height': [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6],
        'tide_rising': [0, 1],
        'next_tide_extreme': [0, 1, 3, 5, 6],
        'secondary_swell_height': [0, 1, 2, 3],
        'secondary_swell_period': [0, 6, 8, 10, 12],
        'secondary_swell_direction': [0, 60, 90, 120, 180],
        'water_temp': [45, 55, 65, 75, 85]
    }
    
    # For a full lookup table, we need to be selective about which dimensions to grid
    # Main factors: height, period, tide_height, wind_speed, wind_direction, tide_rising
    # Secondary factors: use default/median values
    
    main_grids = {
        'wave_height': [0, 1.5, 2, 2.5, 3, 4, 5, 6, 8],
        'wave_period': [5, 7, 8, 10, 11, 12, 13, 15],
        'tide_height': [0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5],
        'wind_speed': [0, 5, 10, 12, 15, 20, 25],
        'wind_direction': [0, 90, 180, 270],  # Cardinal directions
        'tide_rising': [0, 1]
    }
    
    # Fixed defaults for secondary features
    defaults = {
        'wave_direction': 75,  # Ideal direction
        'wind_gusts': 0,       # Will be wind_speed + 5 at runtime
        'next_tide_extreme': 5.0,
        'secondary_swell_height': 0,
        'secondary_swell_period': 0,
        'secondary_swell_direction': 0,
        'water_temp': 70
    }
    
    lookup = {
        'grids': main_grids,
        'defaults': defaults,
        'scores': {}
    }
    
    # Generate all combinations
    import itertools
    
    keys = list(main_grids.keys())
    values = [main_grids[k] for k in keys]
    
    total = 1
    for v in values:
        total *= len(v)
    print(f"\nGenerating lookup table with {total} entries...")
    
    for combo in itertools.product(*values):
        # Build feature vector
        features = dict(zip(keys, combo))
        
        # Fill in defaults
        for k, v in defaults.items():
            features[k] = v
        
        # Adjust gusts based on wind speed
        features['wind_gusts'] = features['wind_speed'] + 5
        
        # Build input array in correct order
        X = [[features[f] for f in FEATURES]]
        
        # Predict
        score = model.predict(X)[0]
        score = max(0, min(100, round(score)))
        
        # Store with tuple key (converted to string for JSON)
        key = '_'.join(str(c) for c in combo)
        lookup['scores'][key] = score
    
    # Save
    with open(output_path, 'w') as f:
        json.dump(lookup, f)
    
    print(f"Saved lookup table to {output_path}")
    print(f"  Entries: {len(lookup['scores'])}")
    
    return lookup


def generate_typescript(output_path):
    """Generate TypeScript inference code."""
    ts_code = '''// Auto-generated surf model inference
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
'''
    
    with open(output_path, 'w') as f:
        f.write(ts_code)
    
    print(f"Generated TypeScript at {output_path}")


def test_predictions(model):
    """Test model with known conditions."""
    print("\nTest Predictions:")
    
    test_cases = [
        {
            'name': 'Perfect day',
            'wave_height': 4, 'wave_period': 11, 'wave_direction': 75,
            'wind_speed': 5, 'wind_direction': 290, 'wind_gusts': 8,
            'tide_height': 3.5, 'tide_rising': 1, 'next_tide_extreme': 5.5,
            'secondary_swell_height': 0, 'secondary_swell_period': 0, 'secondary_swell_direction': 0,
            'water_temp': 75
        },
        {
            'name': 'Low tide, small waves, onshore',
            'wave_height': 1.5, 'wave_period': 7, 'wave_direction': 90,
            'wind_speed': 15, 'wind_direction': 100, 'wind_gusts': 20,
            'tide_height': 0.5, 'tide_rising': 0, 'next_tide_extreme': 0,
            'secondary_swell_height': 0, 'secondary_swell_period': 0, 'secondary_swell_direction': 0,
            'water_temp': 65
        },
        {
            'name': 'Small but clean',
            'wave_height': 2, 'wave_period': 12, 'wave_direction': 70,
            'wind_speed': 3, 'wind_direction': 280, 'wind_gusts': 5,
            'tide_height': 3, 'tide_rising': 1, 'next_tide_extreme': 5,
            'secondary_swell_height': 0, 'secondary_swell_period': 0, 'secondary_swell_direction': 0,
            'water_temp': 72
        },
        {
            'name': 'Big and messy',
            'wave_height': 8, 'wave_period': 9, 'wave_direction': 90,
            'wind_speed': 18, 'wind_direction': 45, 'wind_gusts': 25,
            'tide_height': 2, 'tide_rising': 0, 'next_tide_extreme': 0.5,
            'secondary_swell_height': 2, 'secondary_swell_period': 6, 'secondary_swell_direction': 150,
            'water_temp': 68
        },
    ]
    
    for tc in test_cases:
        name = tc.pop('name')
        X = [[tc[f] for f in FEATURES]]
        pred = model.predict(X)[0]
        pred = max(0, min(100, round(pred)))
        print(f"  {name}: {pred}")


def main():
    print("Loading synthetic data...")
    df = load_data()
    print(f"Loaded {len(df)} samples")
    
    print("\nTraining model...")
    model = train_model(df)
    
    # Test
    test_predictions(model)
    
    # Export
    output_dir = Path(__file__).parent.parent / 'src' / 'data'
    output_dir.mkdir(exist_ok=True)
    
    export_lookup_table(model, output_dir / 'model_lookup.json')
    generate_typescript(Path(__file__).parent.parent / 'src' / 'lib' / 'surfModel.ts')


if __name__ == '__main__':
    main()
