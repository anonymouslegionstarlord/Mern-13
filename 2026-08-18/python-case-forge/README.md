# CaseForge

CaseForge is a zero-dependency Python CLI for maintaining manual test cases in a portable JSON file and exporting execution-ready CSV reports.

## Features

- Add test cases with steps, expected results, priority, type, and status
- List and filter cases by status, priority, or test type
- Update execution status and actual result
- Show dashboard-style execution totals and pass rate
- Export cases to CSV for spreadsheet tools
- Atomic JSON writes, validation, friendly CLI errors, and unit tests

## Requirements

Python 3.11 or newer. There are no third-party runtime dependencies.

## Usage

```bash
python -m caseforge.cli --file cases.json add --title "Valid login" --steps "Open login|Enter valid credentials|Submit" --expected "Dashboard opens" --priority High --type Functional
python -m caseforge.cli --file cases.json list --status Not Run
python -m caseforge.cli --file cases.json update 1 --status Passed --actual "Dashboard opened"
python -m caseforge.cli --file cases.json summary
python -m caseforge.cli --file cases.json export-csv test-cases.csv
```

Use `|` to separate steps when adding a test case.

## Tests

```bash
python -m unittest discover -s tests -v
```

