# SQLGuard

SQLGuard is a dependency-free static safety linter for SQL scripts. It highlights risky patterns before a script reaches a database.

## Features

- Splits statements while respecting quoted strings and SQL comments
- Detects UPDATE or DELETE without WHERE, DROP/TRUNCATE, SELECT *, NULL comparison mistakes, and INSERT without a column list
- Warns when ordinary SELECT statements have no LIMIT
- Text and JSON reports with configurable warning or error failure thresholds
- Input validation, actionable rule codes, and automated tests

SQLGuard never connects to a database and cannot prove that a query is safe. Review findings and test changes in a disposable environment.

## First-time setup

Requires Python 3.11+. No third-party runtime packages are required.

    python -m venv .venv
    source .venv/bin/activate
    python -m pip install -e .
    sqlguard sample.sql

On Windows PowerShell activate with .\.venv\Scripts\Activate.ps1.

The bundled sample intentionally contains errors, so the command returns exit code 1. Other examples:

    sqlguard migrations.sql --format json
    sqlguard report.sql --fail-on warning
    sqlguard reviewed.sql --fail-on never

Run tests:

    python -m unittest discover -s tests -v

Exit codes are 0 when the selected threshold passes, 1 when findings meet that threshold, and 2 for invalid input or file errors.

