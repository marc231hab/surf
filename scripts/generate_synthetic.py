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

def interpolate(value: float, points: list) -> float:
    """Linear interpolation between defined points. Points = [(x, y), ...]"""
    sorted_pts = sorted(points, key=lambda p: p[0])
    
    # Clamp to range
    if value <= sorted_pts[0][0]:
        return sorted_pts[0][1]
    if value >= sorted_pts[-1][0]:
        return sorted_pts[-1][1]
    
    # Find surrounding points and interpolate
    for i in range(len(sorted_pts) - 1):
        x1, y1 = sorted_pts[i]
        x2, y2 = sorted_pts[i + 1]
        if x1 <= value <= x2:
            t = (value - x1) / (x2 - x1)
            return y1 + t * (y2 - y1)
    return 0

def is_offshore_wind(wind_dir: float) -> bool:
    """
    Check if wind is offshore at Folly Beach.
    Offshore: WSW (247.5°), W (270°), WNW (292.5°), NW (315°), N (0/360°)
    Range: 247.5° to 360° and 0° to 22.5° (N)
    """
    return (wind_dir >= 247.5 and wind_dir <= 360) or (wind_dir >= 0 and wind_dir <= 22.5)

def is_onshore_wind(wind_dir: float) -> bool:
    """
    Check if wind is onshore at Folly Beach.
    Onshore: NE (45°), ENE (67.5°), E (90°), ESE (112.5°), SE (135°), S (180°), SW (225°)
    Range: 45° to 225°
    """
    return wind_dir >= 45 and wind_dir <= 225

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
    Uses smooth interpolation curves - no hard brackets.
    """
    score = 50.0  # Start neutral
    
    # =========================================================================
    # WAVE HEIGHT (smooth curve)
    # =========================================================================
    height_curve = [
        (0, -35),    # flat
        (1, -22),    # too small
        (1.5, -15),  # very small
        (2, -6),     # small
        (2.5, 8),    # decent
        (3, 15),     # good
        (3.5, 22),   # great
        (5, 25),     # sweet spot peak
        (6, 22),     # still great
        (8, 15),     # big but good
        (10, 5),     # very big
        (12, -10),   # too big
    ]
    score += interpolate(wave_height, height_curve)
    
    # =========================================================================
    # WAVE PERIOD (smooth curve)
    # =========================================================================
    period_curve = [
        (3, -30),    # wind chop
        (5, -20),    # very short
        (6, -12),    # short
        (7, -2),     # okay
        (8, 8),      # good
        (10, 18),    # great
        (12, 22),    # ideal peak
        (13, 18),    # still great
        (14, 5),     # starting to close out
        (15, -5),    # closes out
        (17, -15),   # too long
    ]
    score += interpolate(wave_period, period_curve)
    
    # =========================================================================
    # WAVE DIRECTION (smooth curve for Folly Beach)
    # =========================================================================
    dir_curve = [
        (0, -20),    # N - offshore, doesn't work
        (45, -18),   # NE - wrong angle
        (75, -8),    # ENE - jetty shadow starts
        (90, -6),    # E - shadowed
        (110, 8),    # ESE - can be great
        (130, 10),   # SE - good
        (150, 12),   # SSE - very good
        (175, 15),   # S - ideal
        (190, 12),   # SSW - still good
        (200, 5),    # SW - shadowed/drifty
        (220, -5),   # WSW - not great
        (250, -15),  # W - offshore direction
        (300, -20),  # NW - wrong
        (360, -20),  # N - wrong
    ]
    score += interpolate(wave_direction, dir_curve)
    
    # =========================================================================
    # TIDE HEIGHT (smooth curve)
    # =========================================================================
    tide_curve = [
        (0, -40),    # too low
        (0.5, -30),  # very low
        (1, -20),    # low
        (1.5, -12),  # still low
        (2, -4),     # below ideal
        (2.5, 6),    # decent
        (3, 12),     # good
        (3.5, 14),   # sweet spot
        (4, 12),     # still good
        (4.5, 6),    # getting high
        (5, 0),      # high
        (5.5, -6),   # too high
        (6, -12),    # way too high
    ]
    score += interpolate(tide_height, tide_curve)
    
    # Rising vs falling tide modifier
    rising_bonus = 8 if tide_rising else -6
    tide_range_factor = 1.0 if (2 <= tide_height <= 4.5) else 0.5
    score += rising_bonus * tide_range_factor
    
    # =========================================================================
    # WIND (smooth curves based on direction)
    # =========================================================================
    offshore = is_offshore_wind(wind_direction)
    onshore = is_onshore_wind(wind_direction)
    
    offshore_curve = [
        (0, 15),    # glassy
        (5, 14),    # light offshore - great
        (10, 10),   # moderate offshore - good
        (15, 3),    # stronger offshore
        (20, -8),   # too strong
        (25, -20),  # way too strong
    ]
    onshore_curve = [
        (0, 15),    # glassy (no direction matters)
        (3, 8),     # barely onshore
        (6, -2),    # light onshore
        (10, -12),  # moderate onshore
        (15, -22),  # strong onshore
        (20, -30),  # blown out
    ]
    cross_curve = [
        (0, 15),    # glassy
        (5, 8),     # light cross
        (10, 0),    # moderate cross
        (15, -10),  # strong cross
        (20, -20),  # too strong
    ]
    
    if wind_speed <= 3:
        score += 15  # Glassy - direction doesn't matter
    elif offshore:
        score += interpolate(wind_speed, offshore_curve)
    elif onshore:
        score += interpolate(wind_speed, onshore_curve)
    else:
        score += interpolate(wind_speed, cross_curve)
    
    # Gust penalty (smooth)
    gust_diff = wind_gusts - wind_speed
    gust_penalty_curve = [(0, 0), (5, -3), (10, -8), (15, -12)]
    score += interpolate(gust_diff, gust_penalty_curve)
    
    # =========================================================================
    # SECONDARY SWELL
    # =========================================================================
    if secondary_swell_height > 0.5:
        sec_dir_diff = angle_difference(secondary_swell_direction, wave_direction)
        if sec_dir_diff > 60:
            # Crossing swells - smooth penalty based on height
            crossing_penalty = interpolate(secondary_swell_height, [(0.5, -2), (2, -6), (4, -12)])
            score += crossing_penalty
        else:
            # Similar direction - can reinforce
            if secondary_swell_period >= 8:
                score += 3  # Good period secondary adds energy
            else:
                score -= 2  # Short period secondary adds chop
    
    # =========================================================================
    # WATER TEMPERATURE (smooth curve - comfort factor)
    # =========================================================================
    temp_curve = [
        (45, -10),   # brutal
        (50, -6),    # very cold
        (55, -3),    # cold
        (60, 0),     # wetsuit needed
        (68, 3),     # nice
        (75, 5),     # warm
        (85, 5),     # warm
    ]
    score += interpolate(water_temp, temp_curve)
    
    # =========================================================================
    # INTERACTION TERMS (smooth multipliers)
    # =========================================================================
    
    # Small waves + short period penalty (multiplicative feel)
    if wave_height < 2.5 and wave_period < 7:
        # Penalty scales with how bad each factor is
        height_badness = max(0, (2.5 - wave_height) / 1.5)  # 0 to 1
        period_badness = max(0, (7 - wave_period) / 3)      # 0 to 1
        score -= height_badness * period_badness * 15
    
    # Low tide + small waves compound
    if tide_height < 2.5 and wave_height < 2.5:
        tide_badness = max(0, (2.5 - tide_height) / 2)
        height_badness = max(0, (2.5 - wave_height) / 1.5)
        score -= tide_badness * height_badness * 12
    
    # Offshore wind bonus only when conditions are decent
    if offshore and wind_speed <= 12 and wave_height >= 2.5 and wave_period >= 7:
        score += 5
    
    # Short period + onshore = rough
    if wave_period < 7 and onshore and wind_speed > 5:
        period_badness = max(0, (7 - wave_period) / 3)
        wind_badness = min(1, (wind_speed - 5) / 10)
        score -= period_badness * wind_badness * 12
    
    # Perfect conditions bonus
    good_direction = (130 <= wave_direction <= 190)
    if (wave_height >= 3 and wave_period >= 9 and
        2.5 <= tide_height <= 4.5 and wind_speed <= 10 and
        (offshore or wind_speed <= 5) and good_direction):
        score += 8
    
    # Floor: 3ft+ waves should never be "Very Poor"
    if wave_height >= 3 and score < 20:
        score = 20
    
    return max(0, min(100, score))


def generate_grid_samples():
    """Generate systematic grid samples for good coverage."""
    samples = []
    
    # Key values for each feature
    heights = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    periods = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16]
    wave_dirs = [80, 100, 120, 140, 160, 175, 190, 200, 220]  # Folly-relevant swell angles
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
