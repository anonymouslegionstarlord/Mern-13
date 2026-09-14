# PixelProbe

PixelProbe is a dependency-free Python CLI that reads image container headers to report dimensions and basic quality signals without decoding pixels or sending files anywhere. It supports PNG, GIF, JPEG, and WebP.

## Features

- Detects the real format from magic bytes rather than trusting the filename
- Reports width, height, megapixels, aspect ratio, orientation, and file size
- Flags filename-extension mismatches
- Scans single files or bounded directory batches
- Enforces configurable header, file-count, and pixel-count safety limits
- Continues across malformed files and reports per-file errors
- Produces human-readable or JSON output with automation-friendly exit codes
- Uses only the Python standard library at runtime

## Requirements

- Python 3.11 or newer

## First-time setup

From this project directory:

~~~bash
python -m venv .venv
~~~

Activate it on macOS/Linux:

~~~bash
source .venv/bin/activate
~~~

Activate it on Windows PowerShell:

~~~powershell
.venv\Scripts\Activate.ps1
~~~

Install the local package:

~~~bash
python -m pip install -e .
~~~

No third-party runtime packages are installed.

## Run

Inspect one or more files:

~~~bash
pixelprobe photo.jpg banner.png
~~~

Scan a directory recursively:

~~~bash
pixelprobe assets --recursive
~~~

Generate JSON and fail when warnings are present:

~~~bash
pixelprobe assets --recursive --format json --fail-on-warning
~~~

To create harmless sample headers and inspect them:

~~~bash
python examples/make_samples.py
pixelprobe examples/generated
~~~

## Test

~~~bash
python -m unittest discover -s tests -v
python -m compileall -q src tests examples
~~~

## Exit codes

- 0: all candidates inspected, or warnings are allowed
- 1: warnings exist with --fail-on-warning
- 2: invalid input, an unreadable/malformed candidate, or a safety-limit failure

PixelProbe deliberately reads metadata only. It does not verify compressed pixel data or replace a malware scanner.
