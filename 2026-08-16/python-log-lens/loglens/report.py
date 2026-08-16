from collections import Counter
from typing import Any, Iterable

from .models import LogRecord
from .parser import LEVELS


def build_report(
    records: Iterable[LogRecord], malformed: int = 0, min_level: str = "DEBUG", top: int = 5
) -> dict[str, Any]:
    min_level = min_level.upper()
    if min_level not in LEVELS:
        raise ValueError(f"minimum level must be one of: {', '.join(LEVELS)}")
    if top < 1:
        raise ValueError("top must be at least 1")

    threshold = LEVELS.index(min_level)
    selected = [record for record in records if LEVELS.index(record.level) >= threshold]
    level_counts = Counter(record.level for record in selected)
    service_counts = Counter(record.service for record in selected)
    message_counts = Counter(record.message for record in selected)

    return {
        "total": len(selected),
        "malformed": malformed,
        "minimum_level": min_level,
        "levels": {level: level_counts[level] for level in LEVELS if level_counts[level]},
        "services": dict(service_counts.most_common()),
        "top_messages": [
            {"message": message, "count": count} for message, count in message_counts.most_common(top)
        ],
    }


def format_text(report: dict[str, Any]) -> str:
    lines = [
        "LogLens report",
        "==============",
        f"Records: {report['total']} (minimum level: {report['minimum_level']})",
        f"Malformed lines: {report['malformed']}",
        "",
        "Levels:",
    ]
    lines.extend(f"  {name:<8} {count}" for name, count in report["levels"].items())
    lines.append("Services:")
    lines.extend(f"  {name:<12} {count}" for name, count in report["services"].items())
    lines.append("Top messages:")
    lines.extend(f"  {item['count']:>3}  {item['message']}" for item in report["top_messages"])
    return "\n".join(lines)

