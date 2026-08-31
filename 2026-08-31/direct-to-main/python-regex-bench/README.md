# RegexBench

RegexBench is a dependency-free Python CLI for running repeatable regular-expression acceptance and rejection cases from JSON.

## Features

- Multiple named patterns with search, match, or fullmatch modes
- IGNORECASE, MULTILINE, DOTALL, and ASCII flags
- Positive and negative cases with per-case labels
- Duplicate-name, pattern, flag, mode, case, and input-size validation
- Text and JSON reports with automation-friendly exit codes
- Automated tests for matching behavior, validation, and CLI output

Python regular expressions can still exhibit catastrophic backtracking. RegexBench limits configuration and case sizes, but untrusted patterns should run in a separately constrained process.

## First-time setup

Requires Python 3.11+. No third-party runtime packages are required.

    python -m venv .venv
    source .venv/bin/activate
    python -m pip install -e .
    regexbench sample_patterns.json

On Windows PowerShell activate with .\.venv\Scripts\Activate.ps1.

JSON report:

    regexbench sample_patterns.json --format json

Run tests:

    python -m unittest discover -s tests -v

Exit codes are 0 when all cases pass, 1 when a case fails, and 2 for invalid input or file errors.

