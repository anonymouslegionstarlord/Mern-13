# LocaleParity

LocaleParity is a dependency-free Python CLI for checking that translated JSON files stay structurally compatible with a reference locale.

## Features

- Recursively compares nested translation keys
- Detects missing, extra, type-mismatched, and empty values
- Verifies named placeholders such as {name} and %(count)d
- Rejects duplicate JSON object keys
- Supports multiple target locales with text and JSON reports
- Configurable warning or error failure thresholds and automated tests

LocaleParity checks structure and placeholders; it does not judge translation quality or cultural appropriateness.

## First-time setup

Requires Python 3.11+. No third-party runtime packages are required.

    python -m venv .venv
    source .venv/bin/activate
    python -m pip install -e .
    localeparity locales/en.json locales/hi.json

On Windows PowerShell activate with .\.venv\Scripts\Activate.ps1.

JSON report and warning gate:

    localeparity locales/en.json locales/hi.json --format json
    localeparity locales/en.json locales/hi.json --fail-on warning

Run tests:

    python -m unittest discover -s tests -v

Exit codes are 0 when the selected threshold passes, 1 when findings meet that threshold, and 2 for invalid input or file errors.

