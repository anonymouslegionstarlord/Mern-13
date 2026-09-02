"""Command-line interface for MarkdownRoute."""

from __future__ import annotations

import argparse
import json
import sys

from .core import audit_markdown


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Check local Markdown links and heading fragments without network access")
    parser.add_argument("target", help="A Markdown file or directory to audit")
    parser.add_argument("--format", choices=("text", "json"), default="text", help="Report format")
    parser.add_argument("--fail-on", choices=("never", "warning", "error"), default="error", help="Exit code 1 threshold")
    return parser


def render_text(report: dict) -> str:
    summary = report["summary"]
    lines = [
        "MarkdownRoute: " + report["target"],
        "Status: " + report["status"].upper(),
        "Files: " + str(summary["files"]),
        "Links: local=" + str(summary["local_links"]) + ", external=" + str(summary["external_links"]),
        "Findings: " + str(len(report["findings"])),
    ]
    for finding in report["findings"]:
        location = finding["source"] + ((":" + str(finding["line"])) if "line" in finding else "")
        lines.append("- " + finding["severity"].upper() + " [" + finding["code"] + "] " + finding["message"] + " — " + location)
    lines.append("Notice: " + report["notice"])
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = audit_markdown(args.target)
    except ValueError as exc:
        print("markdownroute: " + str(exc), file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2, sort_keys=True) if args.format == "json" else render_text(report))
    if args.fail_on == "warning" and (report["counts"]["warning"] or report["counts"]["error"]):
        return 1
    if args.fail_on == "error" and report["counts"]["error"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
