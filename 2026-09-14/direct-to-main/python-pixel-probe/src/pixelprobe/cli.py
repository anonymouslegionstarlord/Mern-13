"""Command-line interface for PixelProbe."""

from __future__ import annotations

import argparse
import json
import sys

from .core import ProbeError, audit_paths


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inspect image dimensions without decoding pixels.")
    parser.add_argument("paths", nargs="+", help="Image files or directories")
    parser.add_argument("-r", "--recursive", action="store_true", help="Scan directories recursively")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    parser.add_argument("--max-files", type=int, default=500)
    parser.add_argument("--max-header-bytes", type=int, default=4 * 1024 * 1024)
    parser.add_argument("--max-pixels", type=int, default=200_000_000)
    parser.add_argument("--fail-on-warning", action="store_true")
    return parser


def render_text(report: dict) -> str:
    lines = []
    for item in report["images"]:
        lines.append(
            f'{item["path"]}: {item["format"]} {item["width"]}x{item["height"]} '
            f'({item["orientation"]}, {item["megapixels"]:.4f} MP)'
        )
        lines.extend(f"  warning: {finding}" for finding in item["findings"])
    lines.extend(f'{item["path"]}: error: {item["error"]}' for item in report["errors"])
    summary = report["summary"]
    lines.append(
        "Summary: "
        f'{summary["inspected"]}/{summary["candidates"]} inspected, '
        f'{summary["warnings"]} warnings, {summary["errors"]} errors'
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = audit_paths(
            args.paths,
            recursive=args.recursive,
            max_files=args.max_files,
            max_header_bytes=args.max_header_bytes,
            max_pixels=args.max_pixels,
        )
    except ProbeError as exc:
        print(f"pixelprobe: {exc}", file=sys.stderr)
        return 2
    if args.format == "json":
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(render_text(report))
    if report["summary"]["errors"]:
        return 2
    if args.fail_on_warning and report["summary"]["warnings"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
