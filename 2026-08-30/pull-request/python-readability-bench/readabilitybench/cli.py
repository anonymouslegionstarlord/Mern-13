"""Command-line interface for ReadabilityBench."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .core import ReadabilityError, analyze


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="readabilitybench", description="Analyze the readability of an English text file")
    root.add_argument("input", help="Path to a UTF-8 text file")
    root.add_argument("--format", choices=("text", "json"), default="text")
    root.add_argument("--max-grade", type=float, help="Return 1 when the estimated grade exceeds this value")
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.max_grade is not None and not 1 <= args.max_grade <= 20:
            raise ReadabilityError("Maximum grade must be between 1 and 20")
        source = Path(args.input)
        report = analyze(source.read_text(encoding="utf-8"))
        report["source"] = str(source)
        if args.format == "json":
            print(json.dumps(report, indent=2))
        else:
            print("ReadabilityBench: " + str(source))
            print("Words: " + str(report["words"]) + " | Sentences: " + str(report["sentences"]) + " | Paragraphs: " + str(report["paragraphs"]))
            print("Reading ease: " + str(report["reading_ease"]) + " | Estimated grade: " + str(report["grade_level"]))
            print("Average sentence: " + str(report["average_sentence_words"]) + " words | Reading time: " + str(report["reading_minutes"]) + " minutes")
            print("Recommendations:")
            for recommendation in report["recommendations"]:
                print("  - " + recommendation)
        return 1 if args.max_grade is not None and report["grade_level"] > args.max_grade else 0
    except (OSError, UnicodeError, ReadabilityError) as exc:
        print("error: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

