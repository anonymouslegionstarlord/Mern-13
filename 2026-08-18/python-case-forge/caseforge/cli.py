import argparse
import json
import sys

from .models import PRIORITIES, STATUSES, TYPES
from .store import CaseStore


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Manage manual test cases")
    root.add_argument("--file", default="cases.json", help="JSON storage file")
    commands = root.add_subparsers(dest="command", required=True)

    add = commands.add_parser("add", help="add a test case")
    add.add_argument("--title", required=True)
    add.add_argument("--steps", required=True, help="steps separated with |")
    add.add_argument("--expected", required=True)
    add.add_argument("--priority", choices=PRIORITIES, default="Medium")
    add.add_argument("--type", choices=TYPES, default="Functional")

    listing = commands.add_parser("list", help="list test cases")
    listing.add_argument("--status", choices=STATUSES)
    listing.add_argument("--priority", choices=PRIORITIES)
    listing.add_argument("--type", choices=TYPES)

    update = commands.add_parser("update", help="record an execution result")
    update.add_argument("id", type=int)
    update.add_argument("--status", choices=STATUSES, required=True)
    update.add_argument("--actual", default="")

    commands.add_parser("summary", help="show execution metrics")
    export = commands.add_parser("export-csv", help="export cases to CSV")
    export.add_argument("destination")
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    store = CaseStore(args.file)
    try:
        if args.command == "add":
            case = store.add(args.title, args.steps.split("|"), args.expected, args.priority, args.type)
            print(f"Created test case {case.id}: {case.title}")
        elif args.command == "list":
            cases = store.list(args.status, args.priority, args.type)
            if not cases:
                print("No test cases found.")
            for case in cases:
                print(f"{case.id:>3}  {case.status:<8}  {case.priority:<8}  {case.title}")
        elif args.command == "update":
            case = store.update(args.id, args.status, args.actual)
            print(f"Updated test case {case.id} to {case.status}")
        elif args.command == "summary":
            print(json.dumps(store.summary(), indent=2))
        elif args.command == "export-csv":
            print(f"Exported to {store.export_csv(args.destination)}")
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

