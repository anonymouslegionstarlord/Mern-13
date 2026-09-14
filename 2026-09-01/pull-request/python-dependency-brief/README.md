# DependencyBrief

DependencyBrief is a dependency-free Python CLI that inventories direct dependencies from `requirements.txt`, `pyproject.toml`, and `package.json`. It works offline and never installs packages or contacts a registry.

## Features

- Reads one supported manifest or discovers supported files in a directory root
- Covers Python runtime/optional dependencies and JavaScript dependency groups
- Classifies declarations as pinned, ranged, unpinned, or direct-source
- Detects malformed manifests, unsupported requirement includes, and conflicting declarations
- Normalizes Python package names for duplicate checks
- Produces human-readable or JSON reports with automation-friendly exit thresholds
- Enforces file-size and dependency-count safety limits

DependencyBrief examines direct declarations only. It does not claim to resolve lockfiles, transitive dependencies, licenses, vulnerabilities, or available updates.

## First-time setup

Requirements: Python 3.11 or newer. There are no third-party runtime dependencies.

1. Open a terminal in this project folder.
2. Create a virtual environment with `python -m venv .venv`.
3. Activate it with `.venv\\Scripts\\activate` on Windows, or `source .venv/bin/activate` on macOS/Linux.
4. Install the local command with `python -m pip install -e .`.
5. Run `dependencybrief sample_project`.

You can run the module without installing it:

    python -m dependencybrief.cli sample_project

## Usage

Audit all supported manifests in a directory:

    dependencybrief /path/to/project

Audit one file and return JSON:

    dependencybrief /path/to/package.json --format json

Fail when warnings are present:

    dependencybrief sample_project --fail-on warning

Exit codes are `0` when the selected threshold is clear, `1` when findings reach that threshold, and `2` for invalid arguments or a missing/unsupported target.

## Tests

From the project root:

    python -m unittest discover -s tests -v
    python -m compileall -q dependencybrief tests

## Scope and security

The tool never follows `-r` or constraint includes, never executes manifest content, and never makes network calls. Direct URL, VCS, workspace, and local declarations are surfaced for human review rather than fetched.
