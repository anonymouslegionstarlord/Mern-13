"""Command-line interface for CSVShield."""

from __future__ import annotations

import argparse
import json
import sys

from .core import audit_csv, sanitize_csv

DELIMITERS = {"comma": ",", "semicolon": ";", "tab": "\t", "pipe": "|"}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Audit CSV structure and spreadsheet formula-execution risks")
    parser.add_argument("csv_file", help="UTF-8 CSV file to audit")
    parser.add_argument("--delimiter", choices=tuple(DELIMITERS), default="comma", help="Input delimiter")
    parser.add_argument("--max-cell-length", type=int, default=1000, help="Warning threshold from 10 to 100000")
    parser.add_argument("--format", choices=("text", "json"), default="text", help="Report format")
    parser.add_argument("--fail-on", choices=("never", "warning", "error"), default="error", help="Exit code 1 threshold")
    parser.add_argument("--sanitize", metavar="OUTPUT.csv", help="Write a new copy with formula-risk cells escaped")
    return parser


def render_text(report: dict) -> str:
    summary = report["summary"]
    lines = [
        "CSVShield: " + report["source"],
        "Status: " + report["status"].upper(),
        "Shape: " + str(summary["data_rows"]) + " data rows × " + str(summary["columns"]) + " columns",
        "Delimiter: " + summary["delimiter"],
        "Formula-risk cells: " + str(summary["formula_risk_cells"]),
        "Findings: " + str(len(report["findings"])),
    ]
    for finding in report["findings"]:
        location = ""
        if "row" in finding:
            location = " — row " + str(finding["row"])
            if "column" in finding:
                location += ", column " + str(finding["column"])
        lines.append("- " + finding["severity"].upper() + " [" + finding["code"] + "] " + finding["message"] + location)
    lines.append("Notice: " + report["notice"])
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    delimiter = DELIMITERS[args.delimiter]
    try:
        report = audit_csv(args.csv_file, delimiter=delimiter, max_cell_length=args.max_cell_length)
        if args.sanitize:
            changed = sanitize_csv(args.csv_file, args.sanitize, delimiter=delimiter)
            print("csvshield: wrote " + args.sanitize + " with " + str(changed) + " escaped cell(s)", file=sys.stderr)
    except ValueError as exc:
        print("csvshield: " + str(exc), file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2, sort_keys=True) if args.format == "json" else render_text(report))
    if args.fail_on == "warning" and (report["counts"]["warning"] or report["counts"]["error"]):
        return 1
    if args.fail_on == "error" and report["counts"]["error"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
