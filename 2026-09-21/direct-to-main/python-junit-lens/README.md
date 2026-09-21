# JUnitLens

JUnitLens is a dependency-free Python CLI for turning one or more JUnit XML reports into a compact QA summary. It works offline and is useful for inspecting CI artifacts, slow tests, and tests that change outcome between runs.

## Features

- Reads JUnit XML files or directories recursively
- Totals passed, failed, errored, and skipped test executions
- Finds slow test cases using a configurable duration threshold
- Flags flaky candidates that both pass and fail across supplied reports
- Produces human-readable text or machine-readable JSON
- Supports failure and flakiness quality gates through exit codes
- Rejects symlinks, oversized XML, DTD/entity declarations, and invalid durations
- Uses bounded file and test-case limits with deterministic output

## Requirements

- Python 3.11+
- No third-party runtime dependencies

## First-time setup

1. Clone the repository and enter this project folder.
2. Create and activate a virtual environment:

   ~~~bash
   python -m venv .venv
   source .venv/bin/activate
   ~~~

   On Windows PowerShell:

   ~~~powershell
   .venv\Scripts\Activate.ps1
   ~~~

3. Install the local command:

   ~~~bash
   python -m pip install -e .
   ~~~

4. Analyze the included reports:

   ~~~bash
   junitlens examples --fail-on none
   junitlens examples --format json --fail-on none
   ~~~

The examples deliberately include one flaky candidate. Use --fail-on failures for failing/error executions, --fail-on flaky for either failures or flaky candidates, or --fail-on none for reporting only.

## Usage

~~~text
junitlens INPUT [INPUT ...] [--format text|json]
          [--slow-seconds SECONDS] [--fail-on none|failures|flaky]
~~~

Each XML file is limited to 2 MiB, each run to 100 input files, and the aggregate to 50,000 test executions.

## Tests and validation

~~~bash
PYTHONPATH=src python -m unittest discover -s tests -v
python -m compileall -q src tests
PYTHONPATH=src python -m junitlens.cli examples --fail-on none
~~~

Virtual environments, caches, coverage data, and package artifacts are ignored.

