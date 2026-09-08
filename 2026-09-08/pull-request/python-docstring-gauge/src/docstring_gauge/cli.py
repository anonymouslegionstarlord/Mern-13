"""CLI for DocstringGauge."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .core import ScanReport, scan_paths


def _percent(value: str) -> float:
    try:
        result = float(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a number") from error
    if not 0 <= result <= 100:
        raise argparse.ArgumentTypeError("must be between 0 and 100")
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Measure Python docstring coverage without importing code.")
    parser.add_argument("paths", nargs="+", type=Path)
    parser.add_argument("--exclude", action="append", default=[], metavar="GLOB")
    parser.add_argument("--include-private", action="store_true")
    parser.add_argument("--no-modules", action="store_true", help="exclude module docstrings from coverage")
    parser.add_argument("--minimum", type=_percent, default=0.0, metavar="PERCENT")
    parser.add_argument("--max-files", type=int, default=5000)
    parser.add_argument("--format", choices=("text", "json"), default="text", dest="output_format")
    return parser


def _text(report: ScanReport, minimum: float) -> str:
    lines = [
        f"Files: {report.files}",
        f"Coverage: {report.coverage:.1f}% ({report.documented}/{len(report.definitions)})",
        f"Minimum: {minimum:.1f}% | parse findings: {len(report.findings)}",
    ]
    missing = [item for item in report.definitions if not item.documented]
    if missing:
        lines.append("\nMissing docstrings:")
        lines.extend(f"- {item.file}:{item.line} {item.kind} {item.name}" for item in missing)
    for finding in report.findings:
        lines.append(f"ERROR {finding.file}:{finding.line} {finding.code}: {finding.message}")
    if not missing and not report.findings:
        lines.append("OK: every selected definition has a docstring")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not 1 <= args.max_files <= 100_000:
        print("docstring-gauge: --max-files must be between 1 and 100,000", file=sys.stderr)
        return 2
    try:
        report = scan_paths(
            args.paths, excludes=tuple(args.exclude), include_private=args.include_private,
            include_modules=not args.no_modules, max_files=args.max_files,
        )
    except ValueError as error:
        print(f"docstring-gauge: {error}", file=sys.stderr)
        return 2
    print(json.dumps(report.to_dict(), indent=2) if args.output_format == "json" else _text(report, args.minimum))
    return int(bool(report.findings) or report.coverage < args.minimum)


if __name__ == "__main__":
    raise SystemExit(main())

