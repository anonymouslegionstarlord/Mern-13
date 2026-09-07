"""CLI for ZipSentry."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .core import InspectionReport, inspect_archive


def _positive_int(value: str) -> int:
    try:
        result = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be an integer") from error
    if result <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return result


def _ratio(value: str) -> float:
    try:
        result = float(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a number") from error
    if not 1 <= result <= 1_000_000:
        raise argparse.ArgumentTypeError("must be between 1 and 1,000,000")
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inspect a ZIP without extracting it.")
    parser.add_argument("archive", type=Path)
    parser.add_argument("--format", choices=("text", "json"), default="text", dest="output_format")
    parser.add_argument("--max-entries", type=_positive_int, default=5_000)
    parser.add_argument("--max-uncompressed", type=_positive_int, default=1_073_741_824, metavar="BYTES")
    parser.add_argument("--max-ratio", type=_ratio, default=100.0)
    parser.add_argument("--fail-on", choices=("warning", "error"), default="error")
    return parser


def _render_text(report: InspectionReport) -> str:
    lines = [
        f"Archive: {report.archive}",
        f"Entries: {report.entries} ({report.files} files, {report.directories} directories)",
        f"Sizes: {report.compressed_bytes} compressed / {report.uncompressed_bytes} uncompressed bytes",
        f"Findings: {report.errors} errors, {report.warnings} warnings",
    ]
    if not report.findings:
        lines.append("OK: no configured risk indicators found")
    for item in report.findings:
        entry = f" [{item.entry}]" if item.entry else ""
        lines.append(f"{item.severity.upper()} {item.code}{entry}: {item.message}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = inspect_archive(
            args.archive, max_entries=args.max_entries,
            max_uncompressed=args.max_uncompressed, max_ratio=args.max_ratio,
        )
    except ValueError as error:
        print(f"zipsentry: {error}", file=sys.stderr)
        return 2

    print(json.dumps(report.to_dict(), indent=2) if args.output_format == "json" else _render_text(report))
    if args.fail_on == "warning":
        return int(bool(report.findings))
    return int(bool(report.errors))


if __name__ == "__main__":
    raise SystemExit(main())

