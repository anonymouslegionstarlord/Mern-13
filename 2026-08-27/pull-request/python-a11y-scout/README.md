# A11yScout

A11yScout is a dependency-free Python CLI for fast, local accessibility checks on HTML files. It catches common markup problems before manual QA or a full browser audit.

## Checks

- Missing document language and title
- Images without `alt`
- Form controls without an associated or ARIA label
- Links and buttons without accessible text
- Duplicate element IDs
- Heading-level jumps
- Missing viewport metadata
- Empty or placeholder link targets

A11yScout is a static pre-check, not a replacement for keyboard, screen-reader, contrast, or browser-based testing.

## First-time setup

Requires Python 3.11+. No third-party runtime packages are required.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
a11yscout sample_page.html
```

On Windows PowerShell activate with `.\.venv\Scripts\Activate.ps1`.

Scan several files or directories recursively:

```bash
a11yscout index.html templates/ --fail-on warning
a11yscout pages/ --json
```

Exit codes: `0` passes the selected threshold, `1` finds matching issues, and `2` indicates invalid input. Run tests with `python -m unittest discover -s tests -v`.

