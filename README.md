# BCAway School Schedules

Raw schedule data and school calendar configurations for Bergen County Academies (BCA), served directly to the BCAway mobile app via GitHub Raw Content.

## Structure

- `data/schedules/` (and `schedules/`): JSON files defining start and end times for each period (`fullDays.json`, `abbreviatedDays.json`, `delayedOpeningDays.json`).
- `data/csv/` (and `csv/`): CSV files indicating calendar days corresponding to each schedule type (`fullDays.csv`, `abbreviatedDays.csv`, `delayedOpeningDays.csv`, `specialDays.csv`).

## Raw Endpoints

Files are consumed directly by BCAway via:
`https://raw.githubusercontent.com/bcaway/school-schedules/refs/heads/main/...`
