# IntegrityMap

IntegrityMap is a zero-dependency Python CLI that creates SHA-256 manifests for directories and later detects missing, modified, or unexpected files.

## Features

- Build deterministic JSON manifests with relative paths, sizes, and SHA-256 hashes
- Verify a directory and classify missing, modified, and unexpected files
- Ignore files with repeatable glob patterns
- Skip symbolic links and the manifest itself for safer scans
- Validate manifest structure and reject unsupported algorithms or unsafe paths
- Human-readable or JSON output with automation-friendly exit codes
- Streaming hashing for large files and a tested standard-library core

## Requirements and setup

Python 3.11 or newer. There are no third-party dependencies.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -e .
integritymap create ./important-files --manifest integrity-manifest.json --ignore "*.tmp"
integritymap verify ./important-files --manifest integrity-manifest.json
```

Exit codes: `0` clean, `1` changes detected, and `2` invalid input or manifest.

## Tests

```bash
python -m unittest discover -s tests -v
```

