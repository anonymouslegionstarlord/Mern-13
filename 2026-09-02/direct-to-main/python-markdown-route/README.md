# MarkdownRoute

MarkdownRoute is a dependency-free Python CLI that checks local links and common heading fragments in Markdown documentation. External URLs are counted but deliberately never fetched.

## Features

- Audit one `.md` file or recursively scan a directory
- Detect missing local files and heading fragments
- Flag links that escape the audited root or use non-portable absolute paths
- Ignore links and headings inside fenced code blocks
- Support duplicate heading anchors with numbered suffixes
- Produce text or JSON reports with configurable exit thresholds
- Enforce file-size and scan-count safety limits

MarkdownRoute uses a practical GitHub-style heading-slug approximation. It focuses on common inline Markdown links rather than implementing every extension of the Markdown specification.

## First-time setup

Requirements: Python 3.11 or newer. There are no third-party runtime dependencies.

1. Open a terminal in this project folder.
2. Create a virtual environment with `python -m venv .venv`.
3. Activate it with `.venv\\Scripts\\activate` on Windows, or `source .venv/bin/activate` on macOS/Linux.
4. Install the local command with `python -m pip install -e .`.
5. Run `markdownroute sample_docs`.

You can also run it without installing:

    python -m markdownroute.cli sample_docs

## Usage

Audit a documentation directory:

    markdownroute /path/to/docs

Create a JSON report:

    markdownroute /path/to/README.md --format json

Fail on warnings as well as errors:

    markdownroute sample_docs --fail-on warning

Exit codes are `0` when the selected threshold is clear, `1` when findings reach that threshold, and `2` for invalid arguments or an invalid target.

## Tests

From the project root:

    python -m unittest discover -s tests -v
    python -m compileall -q markdownroute tests

## Safety scope

The scanner stays inside the selected root, skips common generated/dependency folders, does not execute Markdown, and never performs network requests.
