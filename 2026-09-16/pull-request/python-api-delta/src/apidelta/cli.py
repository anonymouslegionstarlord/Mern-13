"""Command-line interface for APIDelta."""

from __future__ import annotations

import argparse
import json
import sys

from .core import Report, SpecError, compare_files


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Compare two OpenAPI 3 JSON specifications")
    parser.add_argument("baseline", help="path to the baseline OpenAPI JSON file")
    parser.add_argument("current", help="path to the current OpenAPI JSON file")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    parser.add_argument(
        "--allow-breaking",
        action="store_true",
        help="return success even when breaking changes are reported",
    )
    return parser


def render_text(report: Report) -> str:
    lines = [
        "APIDelta compatibility report",
        f"Operations: {report.baseline_operations} baseline -> {report.current_operations} current",
        (
            f"Findings: {report.breaking_count} breaking, "
            f"{report.non_breaking_count} non-breaking, {report.info_count} info"
        ),
    ]
    if not report.findings:
        lines.append("No structural changes detected.")
    for item in report.findings:
        lines.append(f"[{item.severity.upper()}] {item.location}: {item.message} ({item.code})")
    lines.append("Compatibility: " + ("PASS" if report.breaking_count == 0 else "FAIL"))
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = compare_files(args.baseline, args.current)
    except SpecError as error:
        print(f"APIDelta input error: {error}", file=sys.stderr)
        return 2
    if args.format == "json":
        print(json.dumps(report.to_dict(), indent=2, sort_keys=True))
    else:
        print(render_text(report))
    return 0 if args.allow_breaking or report.breaking_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

