# ACLInsight

ACLInsight is a dependency-free Python CLI that validates firewall access-control-list exports and detects rules that are risky, redundant, or unreachable. It performs static analysis only and never changes a firewall.

## Features

- Validates allow/deny actions and TCP, UDP, ICMP, or any protocols
- Parses normalized IPv4 and IPv6 CIDR networks
- Validates single ports, ranges, and any-port rules
- Finds duplicate IDs, redundant rules, and rules shadowed by earlier entries
- Flags public administrative access and broad any-to-any allows
- Handles disabled rules and collects row-level validation errors
- Enforces file-size, row-count, UTF-8, and symlink safety limits
- Produces text or JSON with configurable quality-gate exit codes
- Uses only the Python standard library at runtime

## CSV columns

rule_id, action, protocol, source, destination, source_port, destination_port, enabled

Use any for unrestricted networks or ports. Rules are analyzed in CSV order, matching typical top-to-bottom ACL evaluation.

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

Audit the example:

~~~bash
aclinsight examples/rules.csv
~~~

Create a JSON report:

~~~bash
aclinsight examples/rules.csv --format json
~~~

Fail a pipeline on warnings or errors:

~~~bash
aclinsight examples/rules.csv --fail-on warning
~~~

## Test

~~~bash
python -m unittest discover -s tests -v
python -m compileall -q src tests
~~~

## Exit codes

- 0: the configured quality gate passed
- 1: a finding reached the selected threshold
- 2: unsafe input, invalid structure, or one or more invalid rows

Static ordering checks cannot model vendor-specific objects, state tracking, or runtime routing. Review findings before changing production policy.
