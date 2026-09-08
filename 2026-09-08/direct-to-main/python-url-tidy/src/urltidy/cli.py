"""Command-line interface for URLTidy."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .core import AuditReport, audit_urls


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Audit and normalize URLs without making network requests.")
    parser.add_argument("urls", nargs="*", help="one or more HTTP(S) URLs")
    parser.add_argument("--file", type=Path, help="UTF-8 file containing one URL per line")
    parser.add_argument("--format", choices=("text", "json"), default="text", dest="output_format")
    parser.add_argument("--write-clean", type=Path, metavar="PATH", help="write sanitized URLs to a new file")
    parser.add_argument("--fail-on", choices=("warning", "error"), default="error")
    parser.add_argument("--max-urls", type=int, default=1000)
    return parser


def _text(report: AuditReport) -> str:
    lines = [f"URLs: {len(report.results)} | errors: {report.errors} | warnings: {report.warnings}"]
    for result in report.results:
        lines.append(f"\nLine {result.line}: {result.original}")
        lines.append(f"Clean: {result.sanitized or 'unavailable'}")
        if not result.findings:
            lines.append("OK: no configured issues")
        for finding in result.findings:
            lines.append(f"{finding.severity.upper()} {finding.code}: {finding.message}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    lines = list(args.urls)
    if args.max_urls < 1:
        print("urltidy: --max-urls must be greater than zero", file=sys.stderr)
        return 2
    if args.file:
        try:
            lines.extend(args.file.read_text(encoding="utf-8").splitlines())
        except (OSError, UnicodeError) as error:
            print(f"urltidy: could not read input: {error}", file=sys.stderr)
            return 2
    try:
        report = audit_urls(lines, max_urls=args.max_urls)
    except ValueError as error:
        print(f"urltidy: {error}", file=sys.stderr)
        return 2

    if args.write_clean:
        try:
            with args.write_clean.open("x", encoding="utf-8", newline="\n") as handle:
                for result in report.results:
                    if result.sanitized is not None:
                        handle.write(result.sanitized + "\n")
        except FileExistsError:
            print(f"urltidy: refusing to overwrite {args.write_clean}", file=sys.stderr)
            return 2
        except OSError as error:
            print(f"urltidy: could not write output: {error}", file=sys.stderr)
            return 2

    print(json.dumps(report.to_dict(), indent=2) if args.output_format == "json" else _text(report))
    if args.fail_on == "warning":
        return int(bool(report.errors or report.warnings))
    return int(bool(report.errors))


if __name__ == "__main__":
    raise SystemExit(main())

