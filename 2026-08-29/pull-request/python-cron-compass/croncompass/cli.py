"""Command-line interface for CronCompass."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime

from .core import CronError, next_runs, parse_cron


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="croncompass", description="Validate a five-field cron expression and preview upcoming runs")
    root.add_argument("expression", help="Five-field cron expression")
    root.add_argument("--start", help="ISO date-time; defaults to the current local time")
    root.add_argument("--count", type=int, default=5)
    root.add_argument("--format", choices=("text", "json"), default="text")
    return root


def parse_start(value: str | None) -> datetime:
    if value is None:
        return datetime.now().astimezone()
    normalized = value[:-1] + "+00:00" if value.endswith(("Z", "z")) else value
    try:
        return datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise CronError("Start must be a valid ISO date-time") from exc


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        schedule = parse_cron(args.expression)
        start = parse_start(args.start)
        upcoming = next_runs(schedule, start, args.count)
        report = {
            "expression": schedule.expression,
            "start": start.isoformat(timespec="minutes"),
            "description": schedule.description(),
            "next_runs": [moment.isoformat(timespec="minutes") for moment in upcoming],
        }
        if args.format == "json":
            print(json.dumps(report, indent=2))
        else:
            print("Expression: " + report["expression"])
            print("Start:      " + report["start"])
            print("Fields:")
            for name, description in report["description"].items():
                print("  " + name.replace("_", " ").title() + ": " + description)
            print("Next runs:")
            for moment in report["next_runs"]:
                print("  " + moment)
        return 0
    except CronError as exc:
        print("error: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

