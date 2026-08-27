# TimetableGuard

TimetableGuard is a dependency-free Python CLI that validates class or training schedules and detects overlapping rooms, instructors, and attendee groups.

## Features

- Strict CSV column, weekday, time, identifier, and duplicate validation
- Room, instructor, and group conflict detection
- Exact overlap duration and session-pair reporting
- Room utilization totals and busiest-room summary
- Human-readable and JSON output
- Automation-friendly exit code when conflicts are present

## CSV format

```csv
session_id,day,start_time,end_time,room,instructor,group
CS101-MON,Monday,09:00,10:00,Lab-1,Asha Sharma,MCA-A
DB201-MON,Monday,10:15,11:15,Lab-1,Ravi Mehta,MCA-A
```

## First-time setup

Requires Python 3.11+. No third-party runtime packages are required.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
timetableguard sample_schedule.csv
```

On Windows PowerShell activate with `.\.venv\Scripts\Activate.ps1`.

Use `timetableguard schedule.csv --json` for machine-readable output. The command returns `1` when conflicts exist and `2` for invalid input.

Run tests with:

```bash
python -m unittest discover -s tests -v
```

