"""Command-line interface for ChangelogCraft."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .core import CommitError, build_report, parse_lines, render_markdown


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="changelogcraft", description="Generate release notes from Conventional Commit lines")
    root.add_argument("input", help="Text file containing one commit subject per line")
    root.add_argument("--title", default="Release notes")
    root.add_argument("--format", choices=("markdown", "json"), default="markdown")
    root.add_argument("--type", action="append", default=[], dest="types", help="Commit type to include; repeat as needed")
    root.add_argument("--scope", action="append", default=[], dest="scopes", help="Scope to include; repeat as needed")
    root.add_argument("--allow-unparsed", action="store_true", help="Skip and report invalid lines")
    root.add_argument("--output", help="Optional output file; stdout is used by default")
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        source = Path(args.input)
        lines = source.read_text(encoding="utf-8").splitlines()
        commits, warnings = parse_lines(lines, allow_unparsed=args.allow_unparsed)
        report = build_report(commits, title=args.title, include_types=args.types, include_scopes=args.scopes)
        content = json.dumps(report, indent=2, ensure_ascii=False) + "\n" if args.format == "json" else render_markdown(report)
        for warning in warnings:
            print("warning: " + warning, file=sys.stderr)
        if args.output:
            target = Path(args.output)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            print("Wrote " + str(report["commit_count"]) + " entries to " + str(target))
        else:
            print(content, end="")
        return 0
    except (CommitError, OSError) as exc:
        print("error: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

