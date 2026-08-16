from datetime import datetime
from pathlib import Path
from typing import Iterable

from .models import LogRecord

LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")


def parse_line(line: str) -> LogRecord:
    parts = line.strip().split(maxsplit=3)
    if len(parts) != 4:
        raise ValueError("expected: TIMESTAMP LEVEL SERVICE MESSAGE")

    timestamp_text, level, service, message = parts
    level = level.upper()
    if level not in LEVELS:
        raise ValueError(f"unsupported level: {level}")
    if not service.strip() or not message.strip():
        raise ValueError("service and message cannot be empty")

    try:
        timestamp = datetime.fromisoformat(timestamp_text.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"invalid ISO timestamp: {timestamp_text}") from error

    return LogRecord(timestamp=timestamp, level=level, service=service, message=message)


def parse_lines(lines: Iterable[str]) -> tuple[list[LogRecord], int]:
    records: list[LogRecord] = []
    malformed = 0
    for line in lines:
        if not line.strip():
            continue
        try:
            records.append(parse_line(line))
        except ValueError:
            malformed += 1
    return records, malformed


def read_records(path: str | Path) -> tuple[list[LogRecord], int]:
    log_path = Path(path)
    if not log_path.exists():
        raise FileNotFoundError(f"log file not found: {log_path}")
    if not log_path.is_file():
        raise ValueError(f"path is not a file: {log_path}")
    with log_path.open(encoding="utf-8") as handle:
        return parse_lines(handle)

