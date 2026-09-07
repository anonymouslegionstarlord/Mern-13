# ZipSentry

ZipSentry is a dependency-free Python CLI for inspecting ZIP archives before extraction. It reads metadata only and flags unsafe paths, symbolic links, encrypted entries, duplicate names, suspicious compression ratios, and configurable resource limits.

## Features

- Finds `../` traversal and POSIX/Windows absolute paths
- Identifies duplicate members, symbolic links, and encrypted entries
- Warns on unusually high per-entry compression ratios
- Enforces archive entry and total uncompressed byte limits
- Text and JSON reports with `warning` or `error` failure thresholds
- Clear validation for malformed archives and invalid limits
- Never extracts or modifies an archive

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

Install in editable mode:

```bash
python -m pip install -e .
```

Create and inspect the safe demonstration archive:

```bash
python examples/make_sample.py sample.zip
zipsentry sample.zip
zipsentry sample.zip --format json
```

Inspect your own archive and fail on warnings:

```bash
zipsentry path/to/archive.zip --max-ratio 80 --fail-on warning
```

Exit codes are `0` for success, `1` when a finding meets the selected threshold, and `2` for invalid input. Generated ZIP files are ignored.

## Tests

```bash
python -m unittest discover -s tests -v
python -m compileall -q src tests examples
```

ZipSentry is a preflight aid, not a sandbox or antivirus. Keep extraction tools updated and extract untrusted files into an isolated empty directory with resource limits.

