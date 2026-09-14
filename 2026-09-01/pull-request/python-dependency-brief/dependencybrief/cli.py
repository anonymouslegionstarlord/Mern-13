"""Command-line interface for DependencyBrief."""

from __future__ import annotations

import argparse
import json
import sys

from .core import analyze_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Audit direct dependencies without installing them or using the network")
    parser.add_argument("target", help="A requirements.txt, pyproject.toml, package.json, or directory containing them")
    parser.add_argument("--format", choices=("text", "json"), default="text", help="Report format")
    parser.add_argument("--fail-on", choices=("never", "warning", "error"), default="error", help="Exit code 1 threshold")
    return parser


def render_text(report: dict) -> str:
    summary = report["summary"]
    lines = [
        "DependencyBrief: " + report["target"],
        "Status: " + report["status"].upper(),
        "Manifests: " + ", ".join(report["manifests"]),
        "Dependencies: " + str(summary["total"]) + " (Python " + str(summary["by_ecosystem"]["python"]) + ", JavaScript " + str(summary["by_ecosystem"]["javascript"]) + ")",
        "Version policy: " + ", ".join(key + "=" + str(value) for key, value in summary["by_status"].items()),
        "",
    ]
    for row in report["dependencies"]:
        lines.append("- [" + row["ecosystem"] + "/" + row["status"] + "] " + row["name"] + " " + row["specification"] + " (" + row["group"] + ")")
    lines.append("")
    lines.append("Findings: " + str(len(report["findings"])))
    for finding in report["findings"]:
        lines.append("- " + finding["severity"].upper() + " [" + finding["code"] + "] " + finding["message"] + " — " + finding["source"])
    lines.append("Notice: " + report["notice"])
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = analyze_path(args.target)
    except ValueError as exc:
        print("dependencybrief: " + str(exc), file=sys.stderr)
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
