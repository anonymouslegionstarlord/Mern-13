# APIProbe

APIProbe is a zero-dependency Python CLI for running repeatable HTTP API smoke checks from a JSON plan. It is beginner-friendly, automation-ready, and useful in a QA portfolio.

## Features

- Check GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS endpoints
- Assert expected status and optional response text
- Send JSON bodies and non-secret headers
- Per-check timeout, response-time measurement, and readable pass/fail output
- JSON report export and non-zero exit code when checks fail
- Strict plan validation, friendly errors, and unit-tested runner logic

## Requirements and setup

Python 3.11 or newer. There are no third-party dependencies.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -e .
apiprobe sample_plan.json
```

You can also run `python -m apiprobe.cli sample_plan.json --json reports/result.json`.

## Plan format

Each object requires `name`, `url`, and `expected_status`. Keep tokens and credentials out of committed plan files. If a real service needs authorization, generate a local ignored plan instead.

## Tests

```bash
python -m unittest discover -s tests -v
```

