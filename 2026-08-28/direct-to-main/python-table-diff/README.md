# TableDiff

TableDiff is a dependency-free Python CLI for comparing two CSV dataset versions by a stable key. It is useful for release QA, migration checks, and regression reports.

## Features

- Validates headers, row widths, key columns, and duplicate key values
- Reports added, removed, and field-level changed rows
- Supports ignored columns and numeric comparison tolerance
- Deterministic text and JSON output
- Returns `1` when differences are found and `2` for invalid input

## First-time setup

Requires Python 3.11+. No third-party runtime packages are required.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
tablediff sample_baseline.csv sample_current.csv --key id
```

On Windows PowerShell activate with `.\.venv\Scripts\Activate.ps1`.

The bundled sample intentionally contains differences, so the command exits with code `1`. Other examples:

```bash
tablediff old.csv new.csv --key employee_id --ignore updated_at
tablediff old.csv new.csv --key sku --numeric-tolerance 0.01 --json
```

Run tests with `python -m unittest discover -s tests -v`.

