# DocstringGauge

DocstringGauge is a dependency-free Python CLI that measures docstring coverage without importing or executing the code being inspected. It uses Python's AST to report undocumented modules, classes, methods, functions, and async functions.

## Features

- Scan individual Python files or directories recursively
- Count module, class, method, function, and async-function docstrings
- Ignore private definitions by default, with an opt-in flag
- Report syntax errors as findings instead of crashing the whole scan
- Repeatable glob exclusions and configurable file-count safety limit
- Text and JSON output
- Minimum-coverage quality gate with automation-friendly exit codes

## Requirements and dependencies

- Python 3.11+
- No third-party runtime or test dependencies

## First-time setup

From this project directory:

```bash
python -m venv .venv
```

Activate it on macOS/Linux:

```bash
source .venv/bin/activate
```

On Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install locally:

```bash
python -m pip install -e .
```

Scan the included example:

```bash
docstring-gauge examples
docstring-gauge examples --format json
```

Gate a package at 85% while excluding generated migrations:

```bash
docstring-gauge src --exclude "*/migrations/*" --minimum 85
```

Exit codes are `0` when the scan meets its gate, `1` for syntax findings or insufficient coverage, and `2` for invalid input. Source files are parsed only; they are never imported.

## Tests

```bash
python -m unittest discover -s tests -v
python -m compileall -q src tests examples
```

Docstring presence is not a measure of accuracy. Treat the score as a maintenance signal and review documentation quality separately.

