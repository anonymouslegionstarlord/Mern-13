# CSVShield

CSVShield is a dependency-free Python CLI for reviewing CSV exports before they are opened in spreadsheet software. It detects structural problems, non-printing characters, oversized cells, and values that may execute as formulas.

## Features

- Validate UTF-8 CSV files using comma, semicolon, tab, or pipe delimiters
- Detect duplicate or empty headers and inconsistent row widths
- Flag formula-like values beginning with `=`, `@`, `+`, or `-`
- Avoid false positives for ordinary signed numbers such as `-12.5`
- Report control characters and configurable oversized-cell warnings
- Produce text or JSON reports with configurable exit thresholds
- Optionally write a separate sanitized copy with risky cells prefixed by an apostrophe
- Enforce file, row, and column safety limits

CSVShield reports risk signals, not intent. A formula-like value may be legitimate, so the original data should be reviewed before distribution.

## First-time setup

Requirements: Python 3.11 or newer. There are no third-party runtime dependencies.

1. Open a terminal in this project folder.
2. Create a virtual environment with `python -m venv .venv`.
3. Activate it with `.venv\\Scripts\\activate` on Windows, or `source .venv/bin/activate` on macOS/Linux.
4. Install the local command with `python -m pip install -e .`.
5. Run `csvshield sample.csv`.

You can run it without installing:

    python -m csvshield.cli sample.csv

## Usage

Create a JSON report:

    csvshield sample.csv --format json

Audit a semicolon-delimited file:

    csvshield export.csv --delimiter semicolon

Write a new sanitized copy without changing the source:

    csvshield sample.csv --sanitize sanitized-sample.csv

Fail when warnings are present:

    csvshield sample.csv --fail-on warning

Exit codes are `0` when the selected threshold is clear, `1` when findings reach the threshold, and `2` for invalid input or a failed sanitization operation.

## Tests

From the project root:

    python -m unittest discover -s tests -v
    python -m compileall -q csvshield tests

## Safety and privacy

Reports contain row/column coordinates but never cell values. CSVShield operates locally, makes no network calls, refuses to overwrite source files, and blocks sanitization when structural errors exist.
