import argparse
import json
import sys

from .parser import LEVELS, read_records
from .report import build_report, format_text


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Summarize structured application logs")
    parser.add_argument("file", help="path to the log file")
    parser.add_argument("--min-level", choices=LEVELS, default="DEBUG", help="ignore less severe records")
    parser.add_argument("--top", type=int, default=5, help="number of common messages to show")
    parser.add_argument("--json", action="store_true", help="write JSON instead of text")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        records, malformed = read_records(args.file)
        report = build_report(records, malformed, args.min_level, args.top)
    except (FileNotFoundError, OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    print(json.dumps(report, indent=2) if args.json else format_text(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

