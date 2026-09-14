"""Five-field cron parsing, matching, and next-run calculation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

MONTHS = {name: number for number, name in enumerate(("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"), start=1)}
DAYS = {name: number for number, name in enumerate(("SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"))}
MAX_SEARCH_MINUTES = 5 * 366 * 24 * 60


class CronError(ValueError):
    """Raised when a cron expression or preview request is invalid."""


@dataclass(frozen=True, slots=True)
class Field:
    name: str
    values: frozenset[int]
    minimum: int
    maximum: int
    wildcard: bool

    def matches(self, value: int) -> bool:
        return value in self.values

    def summary(self) -> str:
        return "every " + self.name if self.wildcard else ", ".join(str(value) for value in sorted(self.values))


@dataclass(frozen=True, slots=True)
class CronSchedule:
    expression: str
    minute: Field
    hour: Field
    day_of_month: Field
    month: Field
    day_of_week: Field

    def matches(self, moment: datetime) -> bool:
        if not self.minute.matches(moment.minute) or not self.hour.matches(moment.hour) or not self.month.matches(moment.month):
            return False
        dom_match = self.day_of_month.matches(moment.day)
        cron_weekday = (moment.weekday() + 1) % 7
        dow_match = self.day_of_week.matches(cron_weekday)
        if self.day_of_month.wildcard and self.day_of_week.wildcard:
            return True
        if self.day_of_month.wildcard:
            return dow_match
        if self.day_of_week.wildcard:
            return dom_match
        return dom_match or dow_match

    def description(self) -> dict[str, str]:
        return {
            "minute": self.minute.summary(),
            "hour": self.hour.summary(),
            "day_of_month": self.day_of_month.summary(),
            "month": self.month.summary(),
            "day_of_week": self.day_of_week.summary(),
        }


def parse_number(token: str, *, name: str, minimum: int, maximum: int, aliases: dict[str, int] | None = None, sunday_alias: bool = False) -> int:
    upper = token.upper()
    try:
        value = aliases[upper] if aliases and upper in aliases else int(token)
    except (ValueError, TypeError) as exc:
        raise CronError(name + " contains invalid value " + token) from exc
    allowed_maximum = 7 if sunday_alias else maximum
    if value < minimum or value > allowed_maximum:
        raise CronError(name + " value " + str(value) + " must be between " + str(minimum) + " and " + str(allowed_maximum))
    return 0 if sunday_alias and value == 7 else value


def parse_field(
    text: str,
    *,
    name: str,
    minimum: int,
    maximum: int,
    aliases: dict[str, int] | None = None,
    sunday_alias: bool = False,
) -> Field:
    if not text or any(character.isspace() for character in text):
        raise CronError(name + " field is empty or contains whitespace")
    values: set[int] = set()
    for component in text.split(","):
        if not component:
            raise CronError(name + " contains an empty list component")
        if component.count("/") > 1:
            raise CronError(name + " contains an invalid step")
        base, separator, step_text = component.partition("/")
        if separator:
            try:
                step = int(step_text)
            except ValueError as exc:
                raise CronError(name + " step must be a whole number") from exc
            if step <= 0:
                raise CronError(name + " step must be greater than zero")
        else:
            step = 1

        if base == "*":
            start, end = minimum, 7 if sunday_alias else maximum
        elif "-" in base:
            if base.count("-") != 1:
                raise CronError(name + " contains an invalid range")
            left, right = base.split("-", 1)
            raw_start = parse_number(left, name=name, minimum=minimum, maximum=maximum, aliases=aliases, sunday_alias=False)
            raw_end = parse_number(right, name=name, minimum=minimum, maximum=7 if sunday_alias else maximum, aliases=aliases, sunday_alias=False)
            if raw_start > raw_end:
                raise CronError(name + " range start must not exceed its end")
            start, end = raw_start, raw_end
        else:
            raw_start = parse_number(base, name=name, minimum=minimum, maximum=maximum, aliases=aliases, sunday_alias=sunday_alias)
            start, end = raw_start, (7 if sunday_alias else maximum) if separator else raw_start

        for value in range(start, end + 1, step):
            values.add(0 if sunday_alias and value == 7 else value)

    full = set(range(minimum, maximum + 1))
    return Field(name, frozenset(values), minimum, maximum, values == full)


def parse_cron(expression: str) -> CronSchedule:
    parts = expression.strip().split()
    if len(parts) != 5:
        raise CronError("A cron expression must contain exactly five fields")
    return CronSchedule(
        expression=" ".join(parts),
        minute=parse_field(parts[0], name="minute", minimum=0, maximum=59),
        hour=parse_field(parts[1], name="hour", minimum=0, maximum=23),
        day_of_month=parse_field(parts[2], name="day-of-month", minimum=1, maximum=31),
        month=parse_field(parts[3], name="month", minimum=1, maximum=12, aliases=MONTHS),
        day_of_week=parse_field(parts[4], name="day-of-week", minimum=0, maximum=6, aliases=DAYS, sunday_alias=True),
    )


def next_runs(schedule: CronSchedule, start: datetime, count: int = 5) -> list[datetime]:
    if not isinstance(start, datetime):
        raise CronError("Start must be a datetime")
    if not isinstance(count, int) or isinstance(count, bool) or count < 1 or count > 50:
        raise CronError("Count must be a whole number from 1 to 50")
    cursor = start.replace(second=0, microsecond=0) + timedelta(minutes=1)
    results = []
    for _ in range(MAX_SEARCH_MINUTES):
        if schedule.matches(cursor):
            results.append(cursor)
            if len(results) == count:
                return results
        cursor += timedelta(minutes=1)
    raise CronError("No matching run was found within five years")

