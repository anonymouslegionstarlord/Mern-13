"""Command-line interface for RegexBench."""

from __future__ import annotations

import argparse
import json
import sys

from .core import RegexBenchError, load_config, run_config


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="regexbench", description="Run JSON-defined regular-expression regression cases")
    root.add_argument("config", help="Path to the JSON configuration")
    root.add_argument("--format", choices=("text", "json"), default="text")
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        report = run_config(load_config(args.config))
        if args.format == "json":
            print(json.dumps(report, indent=2))
        else:
            print("RegexBench: " + str(report["passed"]) + "/" + str(report["case_count"]) + " cases passed")
            for pattern in report["patterns"]:
                print(pattern["name"] + ": " + str(pattern["passed"]) + " passed, " + str(pattern["failed"]) + " failed")
                for case in pattern["cases"]:
                    if not case["passed"]:
                        print("  FAIL " + case["label"] + ": expected " + str(case["expected"]).lower() + ", got " + str(case["actual"]).lower())
        return 1 if report["failed"] else 0
    except RegexBenchError as exc:
        print("error: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

