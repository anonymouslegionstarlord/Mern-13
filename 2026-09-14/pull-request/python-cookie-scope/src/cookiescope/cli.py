"""Command-line interface for CookieScope."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .core import CookieError, audit_headers


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Lint Set-Cookie headers without revealing values.")
    parser.add_argument("headers", nargs="*", help="Quoted Set-Cookie header strings")
    parser.add_argument("--file", help="Read one header per line; blank lines and # comments are ignored")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    parser.add_argument("--fail-on", choices=("never", "warning", "error"), default="error")
    parser.add_argument("--max-headers", type=int, default=1000)
    parser.add_argument("--max-length", type=int, default=8192)
    return parser


def _load_file(path: str) -> list[str]:
    candidate = Path(path)
    if candidate.is_symlink() or not candidate.is_file():
        raise CookieError("input path must be a regular, non-symlink file")
    if candidate.stat().st_size > 1_000_000:
        raise CookieError("input file exceeds 1 MB")
    try:
        return [
            line.strip() for line in candidate.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        ]
    except (OSError, UnicodeError) as exc:
        raise CookieError("could not read UTF-8 input file: " + str(exc)) from exc


def render_text(report: dict) -> str:
    lines: list[str] = []
    for cookie in report["cookies"]:
        lines.append(cookie["name"] + " [" + ", ".join(cookie["attributes"]) + "]")
        if not cookie["findings"]:
            lines.append("  ok: no findings")
        for finding in cookie["findings"]:
            lines.append("  " + finding["severity"] + " " + finding["code"] + ": " + finding["message"])
    for error in report["errors"]:
        lines.append("header " + str(error["index"]) + ": parse error: " + error["error"])
    summary = report["summary"]
    lines.append(
        "Summary: "
        + str(summary["inspected"]) + "/" + str(summary["headers"]) + " inspected, "
        + str(summary["error"]) + " errors, "
        + str(summary["warning"]) + " warnings, "
        + str(summary["info"]) + " info, "
        + str(summary["parse_errors"]) + " parse errors"
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        headers = list(args.headers)
        if args.file:
            headers.extend(_load_file(args.file))
        report = audit_headers(headers, max_headers=args.max_headers, max_length=args.max_length)
    except CookieError as exc:
        print("cookiescope: " + str(exc), file=sys.stderr)
        return 2

    if args.format == "json":
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(render_text(report))

    if report["summary"]["parse_errors"]:
        return 2
    if args.fail_on == "warning" and (report["summary"]["warning"] or report["summary"]["error"]):
        return 1
    if args.fail_on == "error" and report["summary"]["error"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

