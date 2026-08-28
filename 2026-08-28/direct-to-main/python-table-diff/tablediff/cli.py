"""Command-line interface for TableDiff."""

from __future__ import annotations

import argparse
import json
import sys

from .core import DiffError, compare_tables, read_table


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="tablediff", description="Compare two CSV files by a stable key")
    root.add_argument("baseline")
    root.add_argument("current")
    root.add_argument("--key", required=True, help="Unique key column")
    root.add_argument("--ignore", action="append", default=[], help="Column to ignore; repeat as needed")
    root.add_argument("--numeric-tolerance", default="0", help="Allowed numeric difference")
    root.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        report = compare_tables(
            read_table(args.baseline), read_table(args.current), key=args.key,
            ignore=args.ignore, numeric_tolerance=args.numeric_tolerance,
        )
        if args.json:
            print(json.dumps(report, indent=2))
        else:
            print(f"Baseline rows: {report['old_rows']} | Current rows: {report['new_rows']}")
            print(f"Added: {report['added_count']} | Removed: {report['removed_count']} | Changed: {report['changed_count']}")
            for item in report["added"]:
                print(f"ADDED   {args.key}={item[args.key]}")
            for item in report["removed"]:
                print(f"REMOVED {args.key}={item[args.key]}")
            for item in report["changed"]:
                changes = ", ".join(f"{field['column']}: {field['old']!r} -> {field['new']!r}" for field in item["fields"])
                print(f"CHANGED {args.key}={item[args.key]} | {changes}")
        return 1 if report["difference_count"] else 0
    except DiffError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

