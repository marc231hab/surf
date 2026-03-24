#!/usr/bin/env python3
"""
Synthetic Data Generator for Folly Beach Surf Model

Generates training data based on Marc's preferences for 13th Street / The Washout.
This encodes expert knowledge about what makes good surfing conditions at this specific spot.

Features (13):
1. wave_height (ft)
2. wave_period (s)
3. wave_direction (°)
4. wind_speed (kn)
5. wind_direction (°)
6. wind_gusts (kn)
7. tide_height (ft)
8. tide_rising (bool)
9. next_tide_extreme (ft)
10. secondary_swell_height (ft)
11. secondary_swell_period (s)
12. secondary_swell_direction (°)
13. water_temp (°F)
"""

import numpy as np
import pandas as pd
import json
import itertools
from pathlib import Path

# Folly Beach faces ESE (~110°), best swells come from E/NE (60-90°)
IDEAL_SWELL_DIRECTION = 75  # degrees
SHORE_NORMAL = 110  # perpendicular to beach

def angle_difference(a: float, b: float) -> float:
    """Calculate smallest angle between two directions (0-180)"""
    diff = abs(a - b) % 360
    return min(diff, 360 - diff)

def is_offshore_wind(wind_dir: float) -> bool:
    """
    Check if wind is offshore at Folly Beach.
    Beach faces ESE (~110°), so offshore is W to NW (270-340°).
    """
    return 250 <= wind_dir <= 350 or wind_dir <= 20

def is_cross_offshore(wind_dir: float) -> bool:
    """Cross-offshore: SW or N"""
    return (200 <= wind_dir < 250) or (340 < wind_dir <= 360) or (0 <= wind_dir <= 30)

def label_surf_score(
    wave_height: float,
    wave_period: float,
    wave_direction: float,
    wind_speed: float,
    wind_direction: float,
    wind_gusts: float,
    tide_height: float,
    tide_rising: bool,
    next_tide_extreme: float,
    secondary_swell_height: float,
    secondary_swell_period: float,
    secondary_swell_direction: float,
    water_temp: float
) -> float:
    """
    Generate happiness score (0-100) based on Marc's preferences for Folly Beach.
    This is the "expert labeling function" that encodes domain knowledge.
    """
    score = 50.0  # Start neutral
    
    # =========================================================================
    # WAVE HEIGHT (most important factor)
    # =========================================================================
    if wave_height >= 3 and wave_height <= 6:
        score += 25  # Sweet spot
    elif wave_height >= 2 and wave_height < 3:
        score += 12  # Decent
    elif wave_height >= 1.5 and wave_height < 2:
        score -= 5   # Small
    elif wave_height < 1.5:
        score -= 30  # Too small to surf
    elif wave_height > 6 and wave_height <= 8:
        score += 18  # Solid day
    elif wave_height > 8 and wave_height <= 10:
        score += 8   # Big, need experience
    elif wave_height > 10:
        score -= 10  # Too big for most
    
    # =========================================================================
    # WAVE PERIOD (critical for wave quality)
    # =========================================================================
    # Folly works best with 10-13s, 14-15s can close out, >15s not ideal
    if wave_period >= 10 and wave_period <= 13:
        score += 22  # Sweet spot for Folly
    elif wave_period >= 8 and wave_period < 10:
        score += 12  # Good
    elif wave_period >= 7 and wave_period < 8:
        score += 5   # Okay
    elif wave_period >= 6 and wave_period < 7:
        score -= 5   # Short, needs good wind
    elif wave_period < 6:
        score -= 18  # Messy wind swell
    elif wave_period > 13 and wave_period <= 15:
        score -= 8   # Closes out at Folly
    elif wave_period > 15:
        score -= 15  # Too long, not ideal for this beach
    
    # =========================================================================
    # WAVE DIRECTION (Folly best with E/NE swells)
    # =========================================================================
    dir_diff = angle_difference(wave_direction, IDEAL_SWELL_DIRECTION)
    if dir_diff <= 15:
        score += 12  # Perfect angle
    elif dir_diff <= 30:
        score += 8   # Great angle
    elif dir_diff <= 45:
        score += 4   # Good
    elif dir_diff <= 60:
        score += 0   # Workable
    elif dir_diff <= 90:
        score -= 8   # Not ideal
    else:
        score -= 15  # Wrong direction, shadowed
    
    # =========================================================================
    # TIDE HEIGHT (3.5ft optimal for Folly)
    # =========================================================================
    if tide_height < 0.5:
        score -= 35  # Almost unsurfable
    elif tide_height < 1.0:
        score -= 25  # Very low, closing out on sandbars
    elif tide_height < 1.5:
        score -= 15  # Low
    elif tide_height < 2.0:
        score -= 5   # Getting better
    elif tide_height >= 3.0 and tide_height <= 4.0:
        score += 12  # Sweet spot
    elif tide_height >= 2.5 and tide_height < 3.0:
        score += 8   # Good
    elif tide_height >= 2.0 and tide_height < 2.5:
        score += 4   # Decent
    elif tide_height > 4.0 and tide_height <= 5.0:
        score += 5   # High but workable
    elif tide_height > 5.0 and tide_height <= 5.5:
        score -= 3   # Getting too high
    elif tide_height > 5.5:
        score -= 8   # Too high
    
    # Tide direction bonus
    if tide_rising and tide_height >= 1.5 and tide_height <= 4.5:
        score += 6  # Rising tide is cleaner
    
    # =========================================================================
    # WIND SPEED & DIRECTION
    # =========================================================================
    offshore = is_offshore_wind(wind_direction)
    cross_offshore = is_cross_offshore(wind_direction)
    
    if wind_speed <= 5:
        score += 15  # Glassy
    elif wind_speed <= 8:
        score += 10  # Light
    elif wind_speed <= 12:
        if offshore:
            score += 8  # Offshore, still good
        elif cross_offshore:
            score += 3  # Cross, okay
        else:
            score -= 5  # Onshore, getting textured
    elif wind_speed <= 15:
        if offshore:
            score += 2  # Offshore helps
        else:
            score -= 12  # Getting rough
    elif wind_speed <= 20:
        if offshore:
            score -= 5  # Even offshore is pushy
        else:
            score -= 20  # Blown out
    else:
        score -= 30  # Too windy regardless
    
    # Gust penalty (gusty conditions are worse than steady)
    gust_diff = wind_gusts - wind_speed
    if gust_diff > 10:
        score -= 8  # Very gusty
    elif gust_diff > 5:
        score -= 4  # Moderately gusty
    
    # =========================================================================
    # SECONDARY SWELL
    # =========================================================================
    if secondary_swell_height > 0.5:
        # Secondary swell present
        sec_dir_diff = angle_difference(secondary_swell_direction, wave_direction)
        
        if sec_dir_diff > 60:
            # Crossing swells - can create confusion
            if secondary_swell_height > 2:
                score -= 10  # Significant crossing swell, messy
            else:
                score -= 4   # Minor crossing swell
        else:
            # Similar direction - can reinforce
            if secondary_swell_period >= 8:
                score += 3  # Good period secondary adds energy
            else:
                score -= 2  # Short period secondary adds chop
    
    # =========================================================================
    # WATER TEMPERATURE (comfort factor)
    # =========================================================================
    if water_temp >= 75:
        score += 5   # Warm, comfortable
    elif water_temp >= 68:
        score += 3   # Nice
    elif water_temp >= 60:
        score += 0   # Wetsuit needed but fine
    elif water_temp >= 55:
        score -= 3   # Cold
    elif water_temp >= 50:
        score -= 6   # Very cold
    else:
        score -= 10  # Brutal
    
    # =========================================================================
    # INTERACTION TERMS
    # =========================================================================
    
    # Small waves + long period = surprisingly good
    if wave_height < 3 and wave_height >= 1.5 and wave_period >= 11:
        score += 10
    
    # Low tide + small waves = very bad (compounds)
    if tide_height < 1.5 and wave_height < 2.5:
        score -= 15
    
    # Offshore wind saves marginal conditions
    if offshore and (wave_height < 3 or tide_height < 2):
        score += 6
    
    # Big waves + good tide = bonus
    if wave_height >= 5 and tide_height >= 3 and tide_height <= 4.5:
        score += 5
    
    # Long period + low tide = closes out harder
    if wave_period > 12 and tide_height < 2:
        score -= 10
    
    # Short period + onshore = miserable
    if wave_period < 8 and not offshore and wind_speed > 10:
        score -= 8
    
    # Perfect combo bonus
    if (wave_height >= 3 and wave_height <= 5 and
        wave_period >= 10 and wave_period <= 12 and
        tide_height >= 2.5 and tide_height <= 4 and
        wind_speed <= 10 and offshore and
        dir_diff <= 30):
        score += 10  # Everything aligned
    
    return max(0, min(100, score))


def generate_grid_samples():
    """Generate systematic grid samples for good coverage."""
    samples = []
    
    # Key values for each feature
    heights = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    periods = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16]
    wave_dirs = [30, 60, 75, 90, 120, 150, 180]  # Various swell angles
    wind_speeds = [0, 5, 8, 10, 12, 15, 18, 22, 28]
    wind_dirs = [0, 45, 90, 135, 180, 225, 270, 315]  # All compass points
    tide_heights = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5]
    water_temps = [48, 55, 62, 70, 78, 85]
    
    # Generate subset of combinations (full grid would be too large)
    for h in heights:
        for p in periods:
            for wd in [60, 75, 90]:  # Focus on common swell directions
                for ws in wind_speeds:
                    for wdir in wind_dirs:
                        for th in tide_heights:
                            for tr in [True, False]:
                                # Simplified: no secondary swell, average water temp
                                sample = {
                                    'wave_height': h,
                                    'wave_period': p,
                                    'wave_direction': wd,
                                    'wind_speed': ws,
                                    'wind_direction': wdir,
                                    'wind_gusts': ws + np.random.uniform(0, 8),
                                    'tide_height': th,
                                    'tide_rising': tr,
                                    'next_tide_extreme': 5.0 if tr else 0.5,
                                    'secondary_swell_height': 0,
                                    'secondary_swell_period': 0,
                                    'secondary_swell_direction': 0,
                                    'water_temp': 70
                                }
                                sample['score'] = label_surf_score(**{k: v for k, v in sample.items() if k != 'score'})
                                samples.append(sample)
    
    return samples


def generate_random_samples(n: int):
    """Generate random samples for continuous coverage."""
    np.random.seed(42)
    samples = []
    
    for _ in range(n):
        wave_height = np.random.exponential(3) + 0.5  # Skewed towards smaller
        wave_height = min(wave_height, 15)
        
        wave_period = np.random.uniform(4, 18)
        wave_direction = np.random.uniform(30, 150)  # E/SE swells common
        
        wind_speed = np.random.exponential(8)
        wind_speed = min(wind_speed, 35)
        wind_direction = np.random.uniform(0, 360)
        wind_gusts = wind_speed + np.random.uniform(0, 12)
        
        tide_height = np.random.uniform(-0.5, 6.5)
        tide_rising = np.random.choice([True, False])
        next_tide_extreme = np.random.uniform(4.5, 6) if tide_rising else np.random.uniform(-0.5, 1)
        
        # Secondary swell (30% of the time)
        if np.random.random() < 0.3:
            secondary_swell_height = np.random.uniform(0.5, 3)
            secondary_swell_period = np.random.uniform(5, 12)
            secondary_swell_direction = np.random.uniform(0, 180)
        else:
            secondary_swell_height = 0
            secondary_swell_period = 0
            secondary_swell_direction = 0
        
        water_temp = np.random.uniform(45, 88)
        
        sample = {
            'wave_height': round(wave_height, 2),
            'wave_period': round(wave_period, 1),
            'wave_direction': round(wave_direction, 0),
            'wind_speed': round(wind_speed, 1),
            'wind_direction': round(wind_direction, 0),
            'wind_gusts': round(wind_gusts, 1),
            'tide_height': round(tide_height, 2),
            'tide_rising': tide_rising,
            'next_tide_extreme': round(next_tide_extreme, 2),
            'secondary_swell_height': round(secondary_swell_height, 2),
            'secondary_swell_period': round(secondary_swell_period, 1),
            'secondary_swell_direction': round(secondary_swell_direction, 0),
            'water_temp': round(water_temp, 1)
        }
        sample['score'] = label_surf_score(**{k: v for k, v in sample.items() if k != 'score'})
        samples.append(sample)
    
    return samples


def main():
    print("Generating synthetic surf dataset for Folly Beach...")
    
    # Generate samples
    print("  Generating grid samples...")
    grid_samples = generate_grid_samples()
    print(f"  Generated {len(grid_samples)} grid samples")
    
    print("  Generating random samples...")
    random_samples = generate_random_samples(50000)
    print(f"  Generated {len(random_samples)} random samples")
    
    # Combine
    all_samples = grid_samples + random_samples
    df = pd.DataFrame(all_samples)
    
    # Save
    output_dir = Path(__file__).parent.parent / 'data'
    output_dir.mkdir(exist_ok=True)
    
    csv_path = output_dir / 'synthetic_surf_data.csv'
    df.to_csv(csv_path, index=False)
    print(f"\nSaved {len(df)} samples to {csv_path}")
    
    # Stats
    print(f"\nDataset statistics:")
    print(f"  Score range: {df['score'].min():.0f} - {df['score'].max():.0f}")
    print(f"  Score mean: {df['score'].mean():.1f}")
    print(f"  Score std: {df['score'].std():.1f}")
    
    # Distribution
    print(f"\nScore distribution:")
    bins = [(0, 25), (25, 40), (40, 55), (55, 70), (70, 85), (85, 100)]
    labels = ['Very Poor', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']
    for (lo, hi), label in zip(bins, labels):
        count = len(df[(df['score'] >= lo) & (df['score'] < hi)])
        pct = count / len(df) * 100
        print(f"  {label} ({lo}-{hi}): {count} ({pct:.1f}%)")


if __name__ == '__main__':
    main()
