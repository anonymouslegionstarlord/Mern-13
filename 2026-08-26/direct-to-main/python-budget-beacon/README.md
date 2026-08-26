# BudgetBeacon

BudgetBeacon is a dependency-free Python CLI that records income and expenses in a local JSON file and turns them into clear monthly budget summaries.

## Features

- Validated income and expense entry with exact decimal arithmetic
- Atomic JSON persistence to reduce the risk of partial writes
- Monthly transaction listing and category totals
- Income, expense, balance, and savings-rate reporting
- Optional category budgets with overspend warnings
- Human-readable and JSON output

## First-time setup

Requires Python 3.11+. No third-party runtime packages are needed.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
budgetbeacon --help
```

On Windows PowerShell, activate with `.\.venv\Scripts\Activate.ps1`.

## Examples

```bash
budgetbeacon --file budget.json add expense 799.00 Food --date 2026-08-26 --note "Weekly groceries"
budgetbeacon --file budget.json add income 45000 Salary
budgetbeacon --file budget.json list --month 2026-08
budgetbeacon --file budget.json summary --month 2026-08 --budget Food=5000 --budget Travel=2500
budgetbeacon --file budget.json summary --json
```

## Tests

```bash
python -m unittest discover -s tests -v
```

The data file is local and should not contain sensitive banking information.

