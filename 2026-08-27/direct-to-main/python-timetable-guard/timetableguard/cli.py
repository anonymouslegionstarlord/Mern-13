"""Command-line interface for TimetableGuard."""

from __future__ import annotations

import argparse
import json
import sys

from .core import ScheduleError, analyze, read_schedule


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="timetableguard", description="Detect room, instructor, and group schedule conflicts")
    root.add_argument("csv_file", help="Timetable CSV file")
    root.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        report = analyze(read_schedule(args.csv_file))
        if args.json:
            print(json.dumps(report, indent=2))
        else:
            print(f"Sessions: {report['session_count']} | Conflicts: {report['conflict_count']}")
            if report["busiest_room"]:
                room = report["busiest_room"]
                print(f"Busiest room: {room} ({report['room_hours'][room]:.2f}h scheduled)")
            for conflict in report["conflicts"]:
                print(
                    f"CONFLICT {conflict['day']} {conflict['resource_type']}={conflict['resource']}: "
                    f"{conflict['session_a']} / {conflict['session_b']} ({conflict['overlap_minutes']} min)"
                )
        return 1 if report["conflict_count"] else 0
    except ScheduleError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

