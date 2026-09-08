# URLTidy

URLTidy is a dependency-free Python CLI that audits URLs offline and creates a privacy-minded normalized version. It never opens a browser or sends a network request.

## Features

- Detects unsupported schemes, missing hosts, and invalid ports
- Flags cleartext HTTP, embedded credentials, fragments, duplicate query keys, and empty parameter names
- Removes common tracking parameters such as `utm_*`, `fbclid`, `gclid`, and `msclkid`
- Lowercases host/scheme, converts international domains to IDNA, and removes default ports
- Text and JSON reports with automation-friendly thresholds
- Optional clean output file with no silent overwrites
- Limits URL length, query-field count, and batch size

## Requirements and dependencies

- Python 3.11+
- No third-party runtime or test dependencies

## First-time setup

From this project folder:

```bash
python -m venv .venv
```

Activate on macOS/Linux:

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

Audit the included examples:

```bash
urltidy --file examples/urls.txt
urltidy --file examples/urls.txt --format json
```

Audit individual URLs and write clean versions:

```bash
urltidy "https://example.com/?utm_source=newsletter&id=7" --write-clean clean-urls.txt
```

URLTidy refuses to overwrite an existing output file. Exit codes are `0` when no finding meets the threshold, `1` when one does, and `2` for invalid CLI/file input.

## Tests

```bash
python -m unittest discover -s tests -v
python -m compileall -q src tests
```

Normalization can change signed or order-sensitive URLs. Review cleaned output before replacing production links.

