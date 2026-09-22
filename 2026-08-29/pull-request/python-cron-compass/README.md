# CronCompass

CronCompass is a dependency-free Python CLI for validating five-field cron expressions and previewing their next run times.

## Features

- Minute, hour, day-of-month, month, and day-of-week fields
- Wildcards, comma lists, ranges, and step expressions
- JAN-DEC and SUN-SAT aliases, with both 0 and 7 accepted for Sunday
- Standard cron day-of-month/day-of-week OR behavior
- Fixed-offset or naive ISO start times
- Text and JSON output with detailed validation errors and automated tests

CronCompass previews schedules; it does not install cron jobs or execute commands.

## First-time setup

Requires Python 3.11+. No third-party runtime packages are required.

    python -m venv .venv
    source .venv/bin/activate
    python -m pip install -e .
    croncompass "*/15 9-17 * * MON-FRI" --start 2026-08-31T08:55:00+05:30

On Windows PowerShell activate with .\.venv\Scripts\Activate.ps1.

JSON example:

    croncompass "0 8 1 JAN,APR,JUL,OCT *" --count 8 --format json

Run tests:

    python -m unittest discover -s tests -v

The command returns 0 on success and 2 for invalid expressions, dates, counts, or file errors.

