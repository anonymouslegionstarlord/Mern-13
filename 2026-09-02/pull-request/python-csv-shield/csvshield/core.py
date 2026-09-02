"""Audit CSV structure and common spreadsheet formula-injection signals."""

from __future__ import annotations

from pathlib import Path
import csv
import re

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 10000
MAX_COLUMNS = 200
DEFAULT_MAX_CELL_LENGTH = 1000
ALLOWED_DELIMITERS = {",", ";", "\t", "|"}
CONTROL_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
NUMBER_PATTERN = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$")


def _finding(severity: str, code: str, message: str, row: int | None = None, column: int | None = None) -> dict:
    finding = {"severity": severity, "code": code, "message": message}
    if row is not None:
        finding["row"] = row
    if column is not None:
        finding["column"] = column
    return finding


def is_formula_risk(value: str) -> bool:
    """Return True for values spreadsheets may interpret as formulas."""
    stripped = value.lstrip(" \t\r\n")
    if not stripped:
        return False
    if stripped[0] in "=@":
        return True
    if stripped[0] in "+-":
        return NUMBER_PATTERN.fullmatch(stripped) is None
    return False


def _validate_options(delimiter: str, max_cell_length: int) -> None:
    if delimiter not in ALLOWED_DELIMITERS:
        raise ValueError("Delimiter must be comma, semicolon, tab, or pipe")
    if not isinstance(max_cell_length, int) or max_cell_length < 10 or max_cell_length > 100000:
        raise ValueError("Maximum cell length must be a whole number from 10 to 100000")


def _read_rows(path: Path, delimiter: str) -> list[list[str]]:
    try:
        size = path.stat().st_size
    except OSError as exc:
        raise ValueError(f"Could not inspect {path}: {exc}") from exc
    if size == 0:
        raise ValueError("CSV file is empty")
    if size > MAX_FILE_BYTES:
        raise ValueError(f"CSV file exceeds the {MAX_FILE_BYTES}-byte safety limit")
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.reader(handle, delimiter=delimiter, strict=True)
            rows = []
            for index, row in enumerate(reader, 1):
                if index > MAX_ROWS + 1:
                    raise ValueError(f"CSV contains more than {MAX_ROWS} data rows")
                rows.append(row)
    except (OSError, UnicodeError, csv.Error) as exc:
        raise ValueError(f"Could not parse {path}: {exc}") from exc
    if not rows:
        raise ValueError("CSV file is empty")
    return rows


def audit_csv(path: str | Path, delimiter: str = ",", max_cell_length: int = DEFAULT_MAX_CELL_LENGTH) -> dict:
    """Audit a CSV without returning cell values in the report."""
    _validate_options(delimiter, max_cell_length)
    source = Path(path)
    rows = _read_rows(source, delimiter)
    header = rows[0]
    findings: list[dict] = []

    if not header:
        findings.append(_finding("error", "missing-header", "Header row has no columns", 1))
    if len(header) > MAX_COLUMNS:
        findings.append(_finding("error", "column-limit", f"Header contains more than {MAX_COLUMNS} columns", 1))

    normalized_headers: dict[str, list[int]] = {}
    for column, value in enumerate(header, 1):
        normalized = value.strip().casefold()
        if not normalized:
            findings.append(_finding("warning", "empty-header", "Header name is empty", 1, column))
        else:
            normalized_headers.setdefault(normalized, []).append(column)
    for positions in normalized_headers.values():
        if len(positions) > 1:
            findings.append(_finding("error", "duplicate-header", "Header name is duplicated in columns " + ", ".join(map(str, positions)), 1, positions[0]))

    formula_cells = 0
    expected_columns = len(header)
    for row_number, row in enumerate(rows, 1):
        if row_number > 1 and len(row) != expected_columns:
            findings.append(_finding("error", "row-width", f"Expected {expected_columns} columns but found {len(row)}", row_number))
        if len(row) > MAX_COLUMNS:
            findings.append(_finding("error", "column-limit", f"Row contains more than {MAX_COLUMNS} columns", row_number))
        for column, value in enumerate(row, 1):
            if len(value) > max_cell_length:
                findings.append(_finding("warning", "long-cell", f"Cell exceeds {max_cell_length} characters", row_number, column))
            if CONTROL_PATTERN.search(value):
                findings.append(_finding("warning", "control-character", "Cell contains a non-printing control character", row_number, column))
            if is_formula_risk(value):
                formula_cells += 1
                findings.append(_finding("warning", "formula-risk", "Cell may be interpreted as a spreadsheet formula", row_number, column))

    counts = {"error": 0, "warning": 0}
    for finding in findings:
        counts[finding["severity"]] += 1
    return {
        "source": str(source),
        "status": "error" if counts["error"] else "warning" if counts["warning"] else "ok",
        "summary": {
            "data_rows": max(0, len(rows) - 1),
            "columns": expected_columns,
            "formula_risk_cells": formula_cells,
            "delimiter": {",": "comma", ";": "semicolon", "\t": "tab", "|": "pipe"}[delimiter],
        },
        "counts": counts,
        "findings": findings,
        "notice": "Findings identify structural and formula-execution risk; they do not classify the underlying data as malicious.",
    }


def sanitize_csv(source: str | Path, destination: str | Path, delimiter: str = ",") -> int:
    """Write a new CSV with formula-risk cells prefixed by an apostrophe."""
    source_path = Path(source).resolve()
    destination_path = Path(destination).resolve()
    if source_path == destination_path:
        raise ValueError("Sanitized output must not overwrite the source file")
    if destination_path.exists():
        raise ValueError("Sanitized output already exists: " + str(destination))
    if not destination_path.parent.is_dir():
        raise ValueError("Sanitized output directory does not exist")
    report = audit_csv(source_path, delimiter=delimiter)
    if report["counts"]["error"]:
        raise ValueError("CSV has structural errors; fix them before creating sanitized output")
    rows = _read_rows(source_path, delimiter)
    sanitized_count = 0
    for row in rows:
        for index, value in enumerate(row):
            if is_formula_risk(value):
                row[index] = "'" + value
                sanitized_count += 1
    try:
        with destination_path.open("x", encoding="utf-8", newline="") as handle:
            csv.writer(handle, delimiter=delimiter, lineterminator="\n").writerows(rows)
    except OSError as exc:
        raise ValueError(f"Could not write {destination}: {exc}") from exc
    return sanitized_count
