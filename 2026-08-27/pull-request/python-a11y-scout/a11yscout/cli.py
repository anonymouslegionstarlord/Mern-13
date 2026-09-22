"""Command-line interface for A11yScout."""

from __future__ import annotations

import argparse
import json
import sys

from .scanner import ScanError, scan_paths


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="a11yscout", description="Run quick static accessibility checks on HTML")
    root.add_argument("paths", nargs="+", help="HTML files or directories")
    root.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    root.add_argument("--fail-on", choices=["error", "warning", "never"], default="error", help="Exit-code threshold (default: error)")
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        report = scan_paths(args.paths)
        if args.json:
            print(json.dumps(report, indent=2))
        else:
            print(f"Files: {report['files_scanned']} | Errors: {report['errors']} | Warnings: {report['warnings']}")
            for issue in report["issues"]:
                print(f"{issue['severity'].upper():7} {issue['source']}:{issue['line']} [{issue['rule']}] {issue['message']}")
        should_fail = args.fail_on == "error" and report["errors"] > 0
        should_fail = should_fail or args.fail_on == "warning" and (report["errors"] > 0 or report["warnings"] > 0)
        return 1 if should_fail else 0
    except ScanError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

