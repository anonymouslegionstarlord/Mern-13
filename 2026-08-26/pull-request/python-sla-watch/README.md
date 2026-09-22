# SLAWatch

SLAWatch is a dependency-free Python CLI that audits support-ticket CSV exports against priority-based response windows. It handles timestamps in a timezone-safe way and produces review-friendly text or JSON reports.

## Features

- Validates required CSV columns, priorities, statuses, unique IDs, and timestamps
- Requires timezone-aware ISO 8601 dates to avoid ambiguous calculations
- Supports P1-P4 SLA targets and command-line overrides
- Detects breached and at-risk open tickets
- Calculates resolved-ticket compliance and priority-level summaries
- Returns exit code `1` when any ticket is breached, useful in automation

## Input format

```csv
ticket_id,opened_at,priority,status,resolved_at
INC-101,2026-08-26T03:00:00Z,P1,resolved,2026-08-26T05:30:00Z
INC-102,2026-08-26T06:00:00+05:30,P2,open,
```

Statuses are `open` and `resolved`. Default targets are P1=4h, P2=8h, P3=24h, and P4=72h.

## First-time setup

Requires Python 3.11+.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
slawatch tickets.csv --as-of 2026-08-26T12:00:00Z
```

On Windows PowerShell activate with `.\.venv\Scripts\Activate.ps1`.

Examples:

```bash
slawatch sample_tickets.csv --as-of 2026-08-26T06:00:00Z
slawatch tickets.csv --json
slawatch tickets.csv --sla P1=2 --sla P2=6
```

Run tests with `python -m unittest discover -s tests -v`.

`sample_tickets.csv` is safe example data for trying the report immediately.

