# MailTrace

MailTrace is a dependency-free Python CLI for inspecting the headers of a saved `.eml` message. It reports structural problems and useful context without printing or analyzing the message body or attachments.

## Features

- Validates required and singleton email headers
- Summarizes sender, recipient count, UTC date, Message-ID, and Received hops
- Extracts reported SPF, DKIM, and DMARC results
- Flags unusual address formats, far-future dates, and From/Return-Path domain differences
- Produces human-readable or JSON reports
- Offers automation-friendly warning/error exit thresholds
- Applies a 2 MiB input safety limit

MailTrace is a diagnostic helper, not a spam detector or forensic verdict. Domain differences and authentication results require context.

## First-time setup

Requirements: Python 3.11 or newer. There are no third-party runtime dependencies.

1. Open a terminal in this project folder.
2. Create a virtual environment with `python -m venv .venv`.
3. Activate it with `.venv\\Scripts\\activate` on Windows, or `source .venv/bin/activate` on macOS/Linux.
4. Install the local command with `python -m pip install -e .`.
5. Run `mailtrace sample_message.eml`.

You can also run the module without installing it:

    python -m mailtrace.cli sample_message.eml

## Usage

Text report:

    mailtrace sample_message.eml

JSON report:

    mailtrace sample_message.eml --format json

Fail on warnings as well as errors:

    mailtrace sample_message.eml --fail-on warning

Exit codes are `0` when the selected threshold is clear, `1` when findings reach the threshold, and `2` for invalid arguments or unreadable/oversized input.

## Tests

From the project root:

    python -m unittest discover -s tests -v
    python -m compileall -q mailtrace tests

## Privacy and scope

The report contains selected header metadata, which can still be sensitive. Run the tool locally and review JSON before sharing it. MailTrace never includes the body or attachments in its output.
