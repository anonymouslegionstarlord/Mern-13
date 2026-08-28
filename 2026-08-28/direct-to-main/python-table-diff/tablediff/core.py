"""CSV validation and keyed table comparison."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable


class DiffError(ValueError):
    """Raised for invalid CSV data or comparison settings."""


@dataclass(frozen=True, slots=True)
class Table:
    source: str
    headers: tuple[str, ...]
    rows: tuple[dict[str, str], ...]


def read_table(path: str | Path) -> Table:
    source = Path(path)
    try:
        with source.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.reader(handle)
            try:
                raw_headers = next(reader)
            except StopIteration as exc:
                raise DiffError(f"{source} is empty") from exc
            headers = tuple(header.strip() for header in raw_headers)
            if not headers or any(not header for header in headers):
                raise DiffError(f"{source} contains an empty column name")
            if len(set(headers)) != len(headers):
                raise DiffError(f"{source} contains duplicate column names")
            rows = []
            for line, values in enumerate(reader, start=2):
                if not values:
                    continue
                if len(values) != len(headers):
                    raise DiffError(f"{source} line {line} has {len(values)} cells; expected {len(headers)}")
                rows.append(dict(zip(headers, values)))
    except OSError as exc:
        raise DiffError(f"Could not read {source}: {exc}") from exc
    return Table(str(source), headers, tuple(rows))


def index_rows(table: Table, key: str) -> dict[str, dict[str, str]]:
    if key not in table.headers:
        raise DiffError(f"Key column '{key}' is missing from {table.source}")
    result = {}
    for line, row in enumerate(table.rows, start=2):
        value = row[key].strip()
        if not value:
            raise DiffError(f"{table.source} line {line} has an empty key")
        if value in result:
            raise DiffError(f"{table.source} contains duplicate key '{value}'")
        result[value] = row
    return result


def equal_value(left: str, right: str, tolerance: Decimal) -> bool:
    if left == right:
        return True
    if tolerance == 0:
        return False
    try:
        return abs(Decimal(left.strip()) - Decimal(right.strip())) <= tolerance
    except InvalidOperation:
        return False


def compare_tables(old: Table, new: Table, *, key: str, ignore: Iterable[str] = (), numeric_tolerance: object = 0) -> dict[str, object]:
    if old.headers != new.headers:
        missing = sorted(set(old.headers) - set(new.headers))
        added = sorted(set(new.headers) - set(old.headers))
        raise DiffError(f"CSV headers differ; removed={missing or 'none'}, added={added or 'none'}, order must also match")
    ignored = set(ignore)
    unknown = sorted(ignored - set(old.headers))
    if unknown:
        raise DiffError(f"Ignored columns do not exist: {', '.join(unknown)}")
    ignored.add(key)
    try:
        tolerance = Decimal(str(numeric_tolerance))
    except InvalidOperation as exc:
        raise DiffError("Numeric tolerance must be a number") from exc
    if not tolerance.is_finite() or tolerance < 0:
        raise DiffError("Numeric tolerance must be finite and non-negative")

    old_rows, new_rows = index_rows(old, key), index_rows(new, key)
    old_keys, new_keys = set(old_rows), set(new_rows)
    added_rows = [{key: value, "row": new_rows[value]} for value in sorted(new_keys - old_keys)]
    removed_rows = [{key: value, "row": old_rows[value]} for value in sorted(old_keys - new_keys)]
    changed_rows = []
    compare_columns = [column for column in old.headers if column not in ignored]
    for value in sorted(old_keys & new_keys):
        fields = [
            {"column": column, "old": old_rows[value][column], "new": new_rows[value][column]}
            for column in compare_columns
            if not equal_value(old_rows[value][column], new_rows[value][column], tolerance)
        ]
        if fields:
            changed_rows.append({key: value, "fields": fields})
    return {
        "key": key,
        "old_rows": len(old.rows),
        "new_rows": len(new.rows),
        "added_count": len(added_rows),
        "removed_count": len(removed_rows),
        "changed_count": len(changed_rows),
        "difference_count": len(added_rows) + len(removed_rows) + len(changed_rows),
        "added": added_rows,
        "removed": removed_rows,
        "changed": changed_rows,
    }
