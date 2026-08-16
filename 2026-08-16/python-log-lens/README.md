# LogLens

LogLens is a zero-dependency Python CLI for turning structured application logs into quick operational summaries.

It accepts lines in this format:

```text
2026-08-16T09:15:00Z INFO api Server started
```

Malformed lines are counted instead of crashing the report.

## Features

- Counts log messages by severity and service
- Reports the most common messages
- Filters by minimum severity
- Exports reports as readable text or JSON
- Uses only the Python standard library
- Includes unit tests for parsing, filtering, and malformed input

## Usage

Python 3.11 or newer is recommended.

```bash
python -m loglens.cli sample.log
python -m loglens.cli sample.log --min-level WARNING --top 3
python -m loglens.cli sample.log --json > report.json
```

## Tests

```bash
python -m unittest discover -s tests -v
```

