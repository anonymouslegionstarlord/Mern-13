# EnvGuard

EnvGuard is a zero-dependency Python CLI that checks a `.env` file against a safe JSON schema. Reports contain variable names and validation messages, never secret values.

## Features

- Detect missing required variables and unexpected keys
- Validate string, integer, number, boolean, URL, and enum values
- Optional minimum, maximum, length, and regular-expression constraints
- Flag placeholder secrets such as `change-me` or `your-token-here`
- Human-readable or JSON reports with automation-friendly exit codes
- Strict schema/input validation, friendly errors, and unit tests

## Requirements and setup

Python 3.11 or newer. There are no third-party dependencies.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -e .
cp .env.example .env
envguard .env env.schema.json
```

You can also run `python -m envguard.cli .env env.schema.json --json reports/env-check.json`.

## Schema

Each key can declare `required`, `type`, `enum`, `pattern`, `min`, `max`, `min_length`, `max_length`, and `secret`. Never put real credentials in the schema or `.env.example`.

## Tests

```bash
python -m unittest discover -s tests -v
```

