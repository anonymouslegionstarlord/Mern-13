# PairwiseForge

PairwiseForge is a dependency-free Python CLI that turns a JSON parameter model into a compact, deterministic set of pairwise test cases.

## Features

- Greedy pair-coverage generation for two or more parameters
- Single-parameter support and deterministic output
- Partial exclusion rules for invalid combinations
- Validation for names, values, exclusions, unreachable values, and unsafe Cartesian sizes
- JSON and CSV output with automation-friendly exit codes
- Automated tests for coverage, constraints, determinism, and rendering

Pairwise coverage reduces combinations; it does not prove complete system correctness. Add focused tests for high-risk business rules.

## First-time setup

Requires Python 3.11+. No third-party runtime packages are required.

    python -m venv .venv
    source .venv/bin/activate
    python -m pip install -e .
    pairwiseforge sample_config.json

On Windows PowerShell activate with .\.venv\Scripts\Activate.ps1.

Export CSV:

    pairwiseforge sample_config.json --format csv --output generated/cases.csv

Run tests:

    python -m unittest discover -s tests -v

The command returns 0 on success and 2 for invalid configuration or file errors.

