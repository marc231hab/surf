# 🌊 Folly Surf

ML-powered surf forecast for Folly Beach, SC (13th Street / The Washout).

## Features

- **13 input features**: wave height, period, direction, wind speed/direction/gusts, tide height/direction, secondary swell, water temp
- **Gradient boosting model**: trained on synthetic data encoding local knowledge
- **Multi-buoy blending**: combines nearby buoy data weighted by relevance
- **Human feedback loop**: tune predictions with real observations
- **Real-time + forecast**: current conditions from measurements, future from predictions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    surf.marchabermann.com                    │
├─────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                  │
│  ├── Buoy feeds (41004, 41029, 41008, 41013)               │
│  ├── NOAA tide predictions + real-time gauge                │
│  └── Open-Meteo marine forecast                             │
├─────────────────────────────────────────────────────────────┤
│  BLENDING LAYER                                              │
│  ├── Distance-weighted buoy fusion                          │
│  └── Forecast vs real-time source switching                 │
├─────────────────────────────────────────────────────────────┤
│  MODEL LAYER                                                 │
│  ├── Synthetic dataset (13 features)                        │
│  ├── Gradient boosting model                                │
│  └── Human feedback refinement                              │
├─────────────────────────────────────────────────────────────┤
│  UI LAYER                                                    │
│  ├── Surf forecast display                                  │
│  └── Tuning dashboard (dials + feedback)                    │
└─────────────────────────────────────────────────────────────┘
```

## Data Sources

| Source | Type | Update | Notes |
|--------|------|--------|-------|
| Buoy 41029 | Swell | 30min | Capers Nearshore (12nm) - primary |
| Buoy 41004 | Swell | 30min | Edisto (41nm) - offshore |
| Buoy 41008 | Swell | 30min | Grays Reef (95nm) |
| Buoy 41013 | Swell | 30min | Frying Pan (120nm) |
| NOAA 8665530 | Tide | 6min | Charleston Harbor |
| Open-Meteo | Forecast | 1hr | Marine API |

## Model Training

```bash
# Generate synthetic training data
python scripts/generate_synthetic.py

# Train model and export lookup table
python scripts/train_model.py
```

## Development

```bash
npm install
npm run dev
```

## Tuning

Visit `/tune` to adjust conditions with dials and provide feedback. Feedback is stored in `data/feedback.jsonl` and can be incorporated into future training runs.

## Roadmap

- [ ] Wave cam integration for ground truth
- [ ] Condition-specific buoy weighting (learned)
- [ ] Historical accuracy tracking
- [ ] Push notifications for good conditions

## License

MIT
