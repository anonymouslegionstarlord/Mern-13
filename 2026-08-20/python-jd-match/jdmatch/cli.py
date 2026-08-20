import argparse
import json
import sys
from pathlib import Path

from .analyzer import analyze, load_catalog


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Compare resume skills with a job description")
    parser.add_argument("resume", help="UTF-8 resume text file")
    parser.add_argument("job_description", help="UTF-8 job-description text file")
    parser.add_argument("--catalog", help="optional JSON skill catalogue")
    parser.add_argument("--top", type=int, default=20, help="maximum matched and missing terms to show")
    parser.add_argument("--json", action="store_true", help="print JSON instead of a text report")
    return parser


def read_text(path: str, label: str) -> str:
    file_path = Path(path)
    if not file_path.is_file():
        raise ValueError(f"{label} file not found: {file_path}")
    try:
        return file_path.read_text(encoding="utf-8")
    except OSError as error:
        raise ValueError(f"cannot read {label}: {error}") from error


def format_report(report: dict, top: int) -> str:
    matched = report["matched"][:top]
    missing = report["missing"][:top]
    lines = [
        "JDMatch report",
        "==============",
        f"Catalogue match: {report['score']:.2f}%",
        f"Matched: {report['matched_count']} / {report['catalogue_skills_in_job']}",
        "",
        "Matched skills:",
        *(f"  + {skill}" for skill in matched),
        "",
        "Missing skills to review truthfully:",
        *(f"  - {skill}" for skill in missing),
    ]
    if not matched:
        lines.insert(7, "  (none detected)")
    if not missing:
        lines.append("  (none detected)")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.top < 1 or args.top > 100:
        print("error: --top must be between 1 and 100", file=sys.stderr)
        return 2
    try:
        report = analyze(read_text(args.resume, "resume"), read_text(args.job_description, "job description"), load_catalog(args.catalog))
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2) if args.json else format_report(report, args.top))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

