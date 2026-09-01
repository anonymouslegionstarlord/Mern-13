"""Command-line interface for MailTrace."""

from __future__ import annotations

import argparse
import json
import sys

from .core import analyze_email, read_email_file


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inspect an .eml file's headers without reading its body")
    parser.add_argument("email_file", help="Path to an RFC-style .eml file")
    parser.add_argument("--format", choices=("text", "json"), default="text", help="Report format")
    parser.add_argument(
        "--fail-on",
        choices=("never", "warning", "error"),
        default="error",
        help="Return exit code 1 at this finding threshold (default: error)",
    )
    return parser


def render_text(report: dict) -> str:
    summary = report["summary"]
    sender = ", ".join(row["address"] or "(invalid)" for row in summary["from"]) or "(missing)"
    auth_parts = []
    for mechanism, values in summary["authentication"].items():
        if values:
            auth_parts.append(mechanism.upper() + "=" + ",".join(values))
    lines = [
        "MailTrace: " + report["source"],
        "Status: " + report["status"].upper(),
        "Subject: " + summary["subject"],
        "From: " + sender,
        "Recipients: " + str(summary["recipient_count"]),
        "Date (UTC): " + (summary["date_utc"] or "unavailable"),
        "Message-ID: " + (summary["message_id"] or "unavailable"),
        "Received hops: " + str(summary["received_hops"]),
        "Authentication: " + ("; ".join(auth_parts) if auth_parts else "not reported"),
        "Findings: " + str(len(report["findings"])),
    ]
    for finding in report["findings"]:
        lines.append("- " + finding["severity"].upper() + " [" + finding["code"] + "] " + finding["message"])
    lines.append("Notice: " + report["notice"])
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = analyze_email(read_email_file(args.email_file), source=args.email_file)
    except (TypeError, ValueError) as exc:
        print("mailtrace: " + str(exc), file=sys.stderr)
        return 2

    if args.format == "json":
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(render_text(report))

    if args.fail_on == "warning" and (report["counts"]["warning"] or report["counts"]["error"]):
        return 1
    if args.fail_on == "error" and report["counts"]["error"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
