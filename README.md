# BCAway School Schedules

Raw schedule data and school calendar configurations for Bergen County Academies (BCA), served directly to the BCAway mobile app via GitHub Raw Content.

## Structure

```
data/
├── csv/
│   ├── abbreviatedDays.csv
│   ├── delayedOpeningDays.csv
│   ├── fullDays.csv
│   └── specialDays.csv
└── schedules/
    ├── abbreviatedDays.json
    ├── delayedOpeningDays.json
    └── fullDays.json
```

## Raw Endpoints

Files are consumed directly by BCAway via:
- `https://raw.githubusercontent.com/bcaway/school-schedules/refs/heads/main/data/schedules/{scheduleType}.json`
- `https://raw.githubusercontent.com/bcaway/school-schedules/refs/heads/main/data/csv/{scheduleType}.csv`
