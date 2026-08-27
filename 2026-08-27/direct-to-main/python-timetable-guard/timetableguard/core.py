"""CSV parsing and timetable conflict detection."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
REQUIRED_COLUMNS = {"session_id", "day", "start_time", "end_time", "room", "instructor", "group"}
TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


class ScheduleError(ValueError):
    """Raised when timetable data is invalid."""


@dataclass(frozen=True, slots=True)
class Session:
    session_id: str
    day: str
    start_minute: int
    end_minute: int
    room: str
    instructor: str
    group: str

    @property
    def start_time(self) -> str:
        return f"{self.start_minute // 60:02d}:{self.start_minute % 60:02d}"

    @property
    def end_time(self) -> str:
        return f"{self.end_minute // 60:02d}:{self.end_minute % 60:02d}"


def parse_time(value: str, field: str) -> int:
    cleaned = str(value or "").strip()
    if not TIME_PATTERN.fullmatch(cleaned):
        raise ScheduleError(f"{field} must use 24-hour HH:MM")
    hour, minute = map(int, cleaned.split(":"))
    return hour * 60 + minute


def _text(value: str, field: str, row: int, limit: int = 80) -> str:
    cleaned = " ".join(str(value or "").split())
    if not cleaned or len(cleaned) > limit:
        raise ScheduleError(f"Row {row}: {field} is required and must be at most {limit} characters")
    return cleaned


def session_from_row(row: dict[str, str], row_number: int) -> Session:
    session_id = _text(row.get("session_id", ""), "session_id", row_number, 64)
    day_raw = _text(row.get("day", ""), "day", row_number, 16).title()
    if day_raw not in DAYS:
        raise ScheduleError(f"Row {row_number}: day must be a full weekday name")
    start = parse_time(row.get("start_time", ""), f"Row {row_number} start_time")
    end = parse_time(row.get("end_time", ""), f"Row {row_number} end_time")
    if end <= start:
        raise ScheduleError(f"Row {row_number}: end_time must be after start_time on the same day")
    return Session(
        session_id=session_id,
        day=day_raw,
        start_minute=start,
        end_minute=end,
        room=_text(row.get("room", ""), "room", row_number),
        instructor=_text(row.get("instructor", ""), "instructor", row_number),
        group=_text(row.get("group", ""), "group", row_number),
    )


def read_schedule(path: str | Path) -> list[Session]:
    source = Path(path)
    try:
        with source.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            missing = sorted(REQUIRED_COLUMNS - set(reader.fieldnames or []))
            if missing:
                raise ScheduleError(f"Missing CSV columns: {', '.join(missing)}")
            sessions = [session_from_row(row, number) for number, row in enumerate(reader, start=2)]
    except OSError as exc:
        raise ScheduleError(f"Could not read {source}: {exc}") from exc
    identifiers = [session.session_id.casefold() for session in sessions]
    if len(identifiers) != len(set(identifiers)):
        raise ScheduleError("session_id values must be unique (case-insensitive)")
    return sessions


def detect_conflicts(sessions: Iterable[Session]) -> list[dict[str, object]]:
    items = list(sessions)
    conflicts: list[dict[str, object]] = []
    resources = (("room", "room"), ("instructor", "instructor"), ("group", "group"))
    for index, left in enumerate(items):
        for right in items[index + 1:]:
            if left.day != right.day:
                continue
            overlap = min(left.end_minute, right.end_minute) - max(left.start_minute, right.start_minute)
            if overlap <= 0:
                continue
            for resource_type, attribute in resources:
                left_value = getattr(left, attribute)
                right_value = getattr(right, attribute)
                if left_value.casefold() == right_value.casefold():
                    conflicts.append({
                        "day": left.day,
                        "resource_type": resource_type,
                        "resource": left_value,
                        "session_a": left.session_id,
                        "session_b": right.session_id,
                        "overlap_minutes": overlap,
                    })
    return sorted(conflicts, key=lambda item: (DAYS.index(item["day"]), item["resource_type"], str(item["resource"]).casefold(), item["session_a"], item["session_b"]))


def analyze(sessions: Iterable[Session]) -> dict[str, object]:
    items = list(sessions)
    conflicts = detect_conflicts(items)
    room_minutes: dict[str, int] = {}
    for session in items:
        room_minutes[session.room] = room_minutes.get(session.room, 0) + session.end_minute - session.start_minute
    utilization = {room: round(minutes / 60, 2) for room, minutes in sorted(room_minutes.items())}
    busiest = max(room_minutes, key=room_minutes.get) if room_minutes else None
    return {
        "session_count": len(items),
        "conflict_count": len(conflicts),
        "conflicts": conflicts,
        "room_hours": utilization,
        "busiest_room": busiest,
    }

