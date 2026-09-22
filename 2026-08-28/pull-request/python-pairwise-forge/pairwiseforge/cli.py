"""Command-line interface for PairwiseForge."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .core import ConfigError, generate, load_config, render_csv


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="pairwiseforge", description="Generate pairwise cases from a JSON parameter model")
    root.add_argument("config", help="Path to the JSON configuration")
    root.add_argument("--format", choices=("json", "csv"), default="json")
    root.add_argument("--output", help="Optional output file; stdout is used by default")
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        report = generate(load_config(args.config))
        content = render_csv(report) if args.format == "csv" else json.dumps(report, indent=2, ensure_ascii=False) + "\n"
        if args.output:
            target = Path(args.output)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            print("Wrote " + str(report["case_count"]) + " cases to " + str(target))
        else:
            print(content, end="")
        return 0
    except (ConfigError, OSError) as exc:
        print("error: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

