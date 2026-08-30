"""Command-line interface for SQLGuard."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .core import SqlGuardError, analyze


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="sqlguard", description="Statically lint a SQL script for risky patterns")
    root.add_argument("input", help="Path to a UTF-8 SQL file")
    root.add_argument("--format", choices=("text", "json"), default="text")
    root.add_argument("--fail-on", choices=("warning", "error", "never"), default="error")
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        source = Path(args.input)
        report = analyze(source.read_text(encoding="utf-8"))
        report["source"] = str(source)
        if args.format == "json":
            print(json.dumps(report, indent=2))
        else:
            print("SQLGuard: " + str(report["statement_count"]) + " statements, " + str(report["finding_count"]) + " findings")
            for item in report["findings"]:
                print(item["severity"].upper() + " " + item["code"] + " statement " + str(item["statement"]) + ": " + item["message"])
            if not report["findings"]:
                print("No configured risks found.")
        if args.fail_on == "never":
            return 0
        if args.fail_on == "warning":
            return 1 if report["finding_count"] else 0
        return 1 if report["counts"]["error"] else 0
    except (OSError, UnicodeError, SqlGuardError) as exc:
        print("error: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

