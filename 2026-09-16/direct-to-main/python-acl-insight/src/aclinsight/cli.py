"""Command-line interface for ACLInsight."""

from __future__ import annotations

import argparse
import json
import sys

from .core import ACLInputError, audit_csv


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate and analyze a firewall ACL CSV export.")
    parser.add_argument("file", help="ACL CSV file")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    parser.add_argument("--fail-on", choices=("never", "warning", "error"), default="error")
    parser.add_argument("--max-rows", type=int, default=5000)
    parser.add_argument("--max-bytes", type=int, default=2_000_000)
    return parser


def render_text(report: dict) -> str:
    lines = [
        item["severity"] + " row " + str(item["row"]) + " " + item["rule_id"]
        + " " + item["code"] + ": " + item["message"]
        for item in report["findings"]
    ]
    lines.extend(
        "error row " + str(item["row"]) + ": " + item["error"]
        for item in report["row_errors"]
    )
    if not lines:
        lines.append("No ACL findings.")
    summary = report["summary"]
    lines.append(
        "Summary: " + str(summary["valid_rules"]) + "/" + str(summary["rows"]) + " valid, "
        + str(summary["error"]) + " errors, " + str(summary["warning"]) + " warnings, "
        + str(summary["info"]) + " info, " + str(summary["invalid_rows"]) + " invalid rows"
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = audit_csv(args.file, max_rows=args.max_rows, max_bytes=args.max_bytes)
    except ACLInputError as exc:
        print("aclinsight: " + str(exc), file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2, sort_keys=True) if args.format == "json" else render_text(report))
    if report["summary"]["invalid_rows"]:
        return 2
    if args.fail_on == "warning" and (report["summary"]["warning"] or report["summary"]["error"]):
        return 1
    if args.fail_on == "error" and report["summary"]["error"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
