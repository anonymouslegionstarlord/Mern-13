# APIDelta

APIDelta is a dependency-free Python CLI that compares two OpenAPI 3 JSON documents before an API release. It highlights compatibility risks without uploading specifications or making network requests.

## Features

- Detects removed paths and HTTP operations
- Finds newly required request parameters and request bodies
- Reports removed successful responses and changed JSON response types
- Identifies added paths, operations, optional parameters, and successful responses
- Produces readable text or automation-friendly JSON
- Returns a failing exit code when breaking changes are present
- Rejects symlinks, oversized files, malformed JSON, and unsupported specifications
- Applies deterministic ordering and bounded input sizes

APIDelta intentionally performs a focused structural comparison. It does not resolve external or local reference objects and does not attempt full JSON Schema compatibility analysis.

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

   On Windows PowerShell, activate it with:

   ~~~powershell
   .venv\Scripts\Activate.ps1
   ~~~

3. Install the local command:

   ~~~bash
   python -m pip install -e .
   ~~~

4. Compare the included examples:

   ~~~bash
   apidelta examples/baseline.json examples/current.json
   apidelta examples/baseline.json examples/current.json --format json
   ~~~

The command exits with code 1 when breaking changes are found and code 2 for invalid input. Use --allow-breaking for an exploratory report that should exit successfully even when risks exist.

## Usage

~~~text
apidelta BASELINE CURRENT [--format text|json] [--allow-breaking]
~~~

Both inputs must be UTF-8 OpenAPI 3 JSON objects no larger than 2 MiB. Specifications can contain at most 1,000 paths and 5,000 operations.

## Tests and validation

~~~bash
PYTHONPATH=src python -m unittest discover -s tests -v
python -m compileall -q src tests
PYTHONPATH=src python -m apidelta.cli examples/baseline.json examples/current.json
~~~

Virtual environments, package artifacts, caches, and coverage files are ignored.

