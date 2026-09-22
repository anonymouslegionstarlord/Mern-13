# CookieScope

CookieScope is a dependency-free Python CLI for reviewing Set-Cookie response headers. It checks common transport, script-access, cross-site, lifetime, and cookie-prefix rules entirely offline.

Reports intentionally include cookie names and attribute names but never cookie values or original headers.

## Features

- Parses optional Set-Cookie prefixes and one-header-per-line files
- Checks Secure, HttpOnly, and SameSite configuration
- Enforces SameSite=None with Secure
- Validates __Secure- and __Host- prefix requirements
- Validates Max-Age, Expires, Domain, Path, and duplicate attributes
- Applies header-count, line-length, input-size, and symlink safety limits
- Continues after malformed entries without echoing sensitive input
- Produces text or JSON with configurable quality-gate exit codes
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

Audit the safe example file:

~~~bash
cookiescope --file examples/headers.txt
~~~

Audit a quoted header:

~~~bash
cookiescope "session=demo; Secure; HttpOnly; SameSite=Lax; Path=/"
~~~

Generate JSON and fail on warnings:

~~~bash
cookiescope --file examples/headers.txt --format json --fail-on warning
~~~

## Test

~~~bash
python -m unittest discover -s tests -v
python -m compileall -q src tests
~~~

## Exit codes

- 0: the chosen quality gate passed
- 1: a warning or error met the --fail-on policy
- 2: invalid arguments, unsafe input, or a parse error

CookieScope is a focused configuration review helper. Browser behavior and application threat models still require manual security testing.
