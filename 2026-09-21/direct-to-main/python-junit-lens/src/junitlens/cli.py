"""Command-line interface for JUnitLens."""

from __future__ import annotations

import argparse
import json
import sys

from .core import Report, ReportError, analyze


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description="Analyze JUnit XML reports offline")
    value.add_argument("inputs", nargs="+", help="JUnit XML files or directories")
    value.add_argument("--format", choices=("text", "json"), default="text")
    value.add_argument("--slow-seconds", type=float, default=1.0)
    value.add_argument("--fail-on", choices=("none", "failures", "flaky"), default="failures")
    return value


def render_text(report: Report) -> str:
    data = report.to_dict()
    summary = data["summary"]
    lines = [
        "JUnitLens report",
        (
            f"Executions: {summary['executions']} | passed {summary['passed']} | "
            f"failed {summary['failed']} | errors {summary['error']} | skipped {summary['skipped']}"
        ),
        f"Duration: {summary['total_seconds']:.3f}s | slow executions: {summary['slow_executions']}",
        f"Flaky candidates: {summary['flaky_candidates']}",
    ]
    for test_id in report.flaky_tests:
        lines.append(f"[FLAKY] {test_id}")
    for item in report.slow_tests:
        lines.append(f"[SLOW] {item.test_id}: {item.seconds:.3f}s ({item.source})")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        report = analyze(args.inputs, args.slow_seconds)
    except ReportError as error:
        print(f"JUnitLens input error: {error}", file=sys.stderr)
        return 2
    print(json.dumps(report.to_dict(), indent=2, sort_keys=True) if args.format == "json" else render_text(report))
    counts = report.status_counts
    has_failures = counts["failed"] + counts["error"] > 0
    if args.fail_on == "failures" and has_failures:
        return 1
    if args.fail_on == "flaky" and (has_failures or report.flaky_tests):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

