# Surf Data Mapping

This document shows exactly how raw buoy data maps to the displayed values.

## Data Sources

| Source | ID | Distance | Weight | URL |
|--------|-----|----------|--------|-----|
| Edisto Buoy | 41004 | 41nm | 0.40 | https://www.ndbc.noaa.gov/station_page.php?station=41004 |
| Capers Nearshore | 41029 | 12nm | 0.35 | https://www.ndbc.noaa.gov/station_page.php?station=41029 |
| Grays Reef | 41008 | 95nm | 0.15 | https://www.ndbc.noaa.gov/station_page.php?station=41008 |
| Frying Pan | 41013 | 120nm | 0.10 | https://www.ndbc.noaa.gov/station_page.php?station=41013 |
| Charleston Tide | 8665530 | - | - | https://tidesandcurrents.noaa.gov/stationhome.html?id=8665530 |

## NDBC Buoy Data Format

Raw file: `https://www.ndbc.noaa.gov/data/realtime2/{BUOY_ID}.txt`

```
#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE
#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC  nmi  hPa    ft
2026 03 23 23 50 230  8.0  9.0   1.4     6   4.6 208 1012.7  20.5  19.4  17.6   MM   MM    MM
```

| Column | Index | Name | Unit | Description |
|--------|-------|------|------|-------------|
| 0-4 | 0-4 | YY MM DD hh mm | - | Timestamp |
| 5 | 5 | WDIR | degrees | Wind direction (from) |
| 6 | 6 | WSPD | m/s | Wind speed |
| 7 | 7 | GST | m/s | Wind gust |
| 8 | 8 | WVHT | meters | Significant wave height |
| 9 | 9 | DPD | seconds | Dominant wave period |
| 10 | 10 | APD | seconds | Average wave period |
| 11 | 11 | MWD | degrees | Mean wave direction |
| 12 | 12 | PRES | hPa | Sea level pressure |
| 13 | 13 | ATMP | °C | Air temperature |
| 14 | 14 | WTMP | °C | Water temperature |
| 15 | 15 | DEWP | °C | Dewpoint |

**Note:** `MM` indicates missing data.

## Conversions Applied

| Metric | Raw Unit | Display Unit | Formula |
|--------|----------|--------------|---------|
| Wave Height | meters | feet | `meters × 3.281` |
| Wind Speed | m/s | knots | `m/s × 1.944` |
| Wind Gusts | m/s | knots | `m/s × 1.944` |
| Water Temp | °C | °F | `°C × 9/5 + 32` |
| Directions | degrees | degrees | No conversion |
| Period | seconds | seconds | No conversion |

## Blending Algorithm

Each metric is blended independently using weighted averages:

```
For each metric M:
  weighted_sum = Σ (value_i × weight_i) for all buoys with valid data
  total_weight = Σ (weight_i) for all buoys with valid data
  
  blended_value = weighted_sum / total_weight
```

**Key:** Each metric uses only the weights of buoys that have valid data for that specific metric.

## Example Calculation

Given raw data (March 24, 2026):

| Buoy | WVHT (m) | DPD (s) | WTMP (°C) | Weight |
|------|----------|---------|-----------|--------|
| 41004 | 1.4 | 6 | 19.4 | 0.40 |
| 41029 | MM | MM | 16.1 | 0.35 |
| 41008 | 0.6 | 3 | MM | 0.15 |
| 41013 | 1.6 | 7 | 17.8 | 0.10 |

**Wave Height:**
```
Only 41004, 41008, 41013 have data
weighted = (1.4×0.4 + 0.6×0.15 + 1.6×0.10) = 0.56 + 0.09 + 0.16 = 0.81m
total_weight = 0.40 + 0.15 + 0.10 = 0.65
blended = 0.81 / 0.65 = 1.25m = 4.1 ft
```

**Water Temp:**
```
Only 41004, 41029, 41013 have data
weighted = (19.4×0.4 + 16.1×0.35 + 17.8×0.10) = 7.76 + 5.64 + 1.78 = 15.18°C
total_weight = 0.40 + 0.35 + 0.10 = 0.85
blended = 15.18 / 0.85 = 17.9°C = 64.1°F
```

## NOAA Tide Data

**Real-time water level:**
```
https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?
  date=latest
  &station=8665530
  &product=water_level
  &datum=MLLW
  &units=english
  &time_zone=lst_ldt
  &format=json
```

Response:
```json
{
  "data": [{"t": "2026-03-24 20:30", "v": "1.589", ...}]
}
```

**Hi/Lo predictions:**
```
https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?
  begin_date=YYYYMMDD
  &end_date=YYYYMMDD
  &station=8665530
  &product=predictions
  &datum=MLLW
  &units=english
  &time_zone=lst_ldt
  &interval=hilo
  &format=json
```

## Feature → Display Mapping

| Display Field | Source(s) | Calculation |
|---------------|-----------|-------------|
| Wave Height | Buoys WVHT | Weighted avg, m→ft |
| Wave Period | Buoys DPD | Weighted avg |
| Wave Direction | Buoys MWD | Weighted avg |
| Wind Speed | Buoys WSPD | Weighted avg, m/s→kn |
| Wind Direction | Buoys WDIR | Weighted avg |
| Wind Gusts | Buoys GST | Weighted avg, m/s→kn |
| Tide Height | NOAA water_level | Direct (ft) |
| Tide Rising | NOAA hilo | Compare last H/L times |
| Next Tide Extreme | NOAA hilo | Next H or L height |
| Water Temp | Buoys WTMP | Weighted avg, °C→°F |
| Confidence | - | `min(1, height_weight / 0.8)` |

## ML Model Features

The surf score model uses 13 features:

| # | Feature | Source | Notes |
|---|---------|--------|-------|
| 1 | wave_height | Blended | feet |
| 2 | wave_period | Blended | seconds |
| 3 | wave_direction | Blended | degrees |
| 4 | wind_speed | Blended | knots |
| 5 | wind_direction | Blended | degrees |
| 6 | wind_gusts | Blended | knots |
| 7 | tide_height | NOAA | feet MLLW |
| 8 | tide_rising | NOAA | boolean |
| 9 | next_tide_extreme | NOAA | feet |
| 10 | secondary_swell_height | Not yet | feet |
| 11 | secondary_swell_period | Not yet | seconds |
| 12 | secondary_swell_direction | Not yet | degrees |
| 13 | water_temp | Blended | °F |
