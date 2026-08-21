from __future__ import annotations

import csv
import io
import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any


class ProfileError(ValueError):
    """Raised when CSV input cannot be profiled safely."""


def parse_csv(content: bytes, delimiter: str = ",", max_rows: int = 10_000) -> tuple[list[str], list[list[str]]]:
    if not content:
        raise ProfileError("CSV file is empty")
    if len(delimiter) != 1 or delimiter in {"\r", "\n", '"'}:
        raise ProfileError("delimiter must be one safe character")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ProfileError("CSV must use UTF-8 encoding") from error
    try:
        reader = csv.reader(io.StringIO(text), delimiter=delimiter, strict=True)
        header = next(reader, None)
        if header is None:
            raise ProfileError("CSV file is empty")
        header = [cell.strip() for cell in header]
        if not header or any(not cell for cell in header):
            raise ProfileError("every column must have a non-empty header")
        folded = [cell.casefold() for cell in header]
        if len(folded) != len(set(folded)):
            raise ProfileError("column headers must be unique")
        rows = []
        for line_number, row in enumerate(reader, start=2):
            if not any(cell.strip() for cell in row):
                continue
            if len(row) != len(header):
                raise ProfileError(f"row {line_number} has {len(row)} values; expected {len(header)}")
            rows.append([cell.strip() for cell in row])
            if len(rows) > max_rows:
                raise ProfileError(f"CSV exceeds the {max_rows}-row limit")
    except csv.Error as error:
        raise ProfileError(f"invalid CSV syntax: {error}") from error
    return header, rows


def infer_type(values: list[str]) -> str:
    if not values:
        return "empty"
    lowered = [value.casefold() for value in values]
    if all(re.fullmatch(r"[+-]?\d+", value) for value in values):
        return "integer"
    try:
        for value in values:
            Decimal(value)
        return "decimal"
    except InvalidOperation:
        pass
    if all(value in {"true", "false", "yes", "no"} for value in lowered):
        return "boolean"
    try:
        for value in values:
            date.fromisoformat(value)
        return "date"
    except ValueError:
        return "text"


def profile_csv(content: bytes, delimiter: str = ",", missing_markers: set[str] | None = None) -> dict[str, Any]:
    headers, rows = parse_csv(content, delimiter)
    markers = {"", "na", "n/a", "null", "none"} if missing_markers is None else {item.casefold() for item in missing_markers}
    columns = []
    for index, name in enumerate(headers):
        raw = [row[index] for row in rows]
        present = [value for value in raw if value.casefold() not in markers]
        kind = infer_type(present)
        report: dict[str, Any] = {
            "name": name,
            "type": kind,
            "missing": len(raw) - len(present),
            "missing_percent": round((len(raw) - len(present)) / len(rows) * 100, 2) if rows else 0.0,
            "distinct": len(set(present)),
            "sample": present[:3],
        }
        if kind in {"integer", "decimal"} and present:
            numbers = [Decimal(value) for value in present]
            report["numeric"] = {
                "min": float(min(numbers)), "max": float(max(numbers)),
                "mean": round(float(sum(numbers) / len(numbers)), 4),
            }
        columns.append(report)
    total_cells = len(rows) * len(headers)
    missing_cells = sum(column["missing"] for column in columns)
    return {
        "rows": len(rows), "columns": len(headers), "missing_cells": missing_cells,
        "completeness_percent": round((total_cells - missing_cells) / total_cells * 100, 2) if total_cells else 100.0,
        "column_profiles": columns,
    }

