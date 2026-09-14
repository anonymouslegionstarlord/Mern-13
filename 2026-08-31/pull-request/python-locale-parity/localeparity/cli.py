"""Command-line interface for LocaleParity."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .core import LocaleError, compare, load_locale


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="localeparity", description="Compare translated JSON files with a reference locale")
    root.add_argument("reference", help="Reference JSON locale")
    root.add_argument("targets", nargs="+", help="One or more translated JSON locales")
    root.add_argument("--format", choices=("text", "json"), default="text")
    root.add_argument("--fail-on", choices=("warning", "error", "never"), default="error")
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        reference = load_locale(args.reference)
        reports = [compare(reference, load_locale(path), target_name=str(Path(path))) for path in args.targets]
        result = {
            "reference": str(Path(args.reference)),
            "targets": len(reports),
            "errors": sum(report["errors"] for report in reports),
            "warnings": sum(report["warnings"] for report in reports),
            "reports": reports,
        }
        if args.format == "json":
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print("LocaleParity: " + str(result["targets"]) + " target(s), " + str(result["errors"]) + " errors, " + str(result["warnings"]) + " warnings")
            for report in reports:
                print(report["target"] + ": " + str(report["errors"]) + " errors, " + str(report["warnings"]) + " warnings")
                for item in report["findings"]:
                    print("  " + item["severity"].upper() + " " + item["code"] + " " + item["key"] + ": " + item["message"])
        if args.fail_on == "never":
            return 0
        if args.fail_on == "warning":
            return 1 if result["errors"] or result["warnings"] else 0
        return 1 if result["errors"] else 0
    except LocaleError as exc:
        print("error: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

