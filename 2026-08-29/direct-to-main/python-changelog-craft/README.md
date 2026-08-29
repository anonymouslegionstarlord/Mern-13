# ChangelogCraft

ChangelogCraft is a dependency-free Python CLI that converts Conventional Commit lines into structured Markdown or JSON release notes.

## Features

- Parses commit type, optional scope, description, and breaking-change markers
- Groups features, fixes, performance improvements, and maintenance work
- Places breaking changes first and preserves their original category
- Optional type and scope filters
- Strict validation by default, with an allow-unparsed mode for mixed histories
- Deterministic Markdown and JSON output with automated tests

## First-time setup

Requires Python 3.11+. No third-party runtime packages are required.

    python -m venv .venv
    source .venv/bin/activate
    python -m pip install -e .
    changelogcraft sample_commits.txt --title "Release 1.4.0"

On Windows PowerShell activate with .\.venv\Scripts\Activate.ps1.

JSON and filtered examples:

    changelogcraft sample_commits.txt --format json
    changelogcraft sample_commits.txt --type feat --type fix --scope api

Use --allow-unparsed to skip merge commits or other non-Conventional Commit lines while reporting them to stderr.

Run tests:

    python -m unittest discover -s tests -v

The command returns 0 on success and 2 for invalid input or file errors.

