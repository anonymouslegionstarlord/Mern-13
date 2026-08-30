"""SQL statement splitting and static safety rules."""

from __future__ import annotations

import re


class SqlGuardError(ValueError):
    """Raised for invalid or empty SQL input."""


def split_statements(sql: str) -> list[str]:
    if not isinstance(sql, str):
        raise SqlGuardError("SQL input must be text")
    statements = []
    buffer = []
    quote = None
    line_comment = False
    block_comment = False
    index = 0
    while index < len(sql):
        char = sql[index]
        next_char = sql[index + 1] if index + 1 < len(sql) else ""
        if line_comment:
            if char == "\n":
                line_comment = False
                buffer.append(" ")
            index += 1
            continue
        if block_comment:
            if char == "*" and next_char == "/":
                block_comment = False
                index += 2
            else:
                index += 1
            continue
        if quote:
            buffer.append(char)
            if char == quote:
                if next_char == quote:
                    buffer.append(next_char)
                    index += 2
                    continue
                quote = None
            index += 1
            continue
        if char in ("'", '"'):
            quote = char
            buffer.append(char)
            index += 1
            continue
        if char == "-" and next_char == "-":
            line_comment = True
            index += 2
            continue
        if char == "/" and next_char == "*":
            block_comment = True
            index += 2
            continue
        if char == ";":
            value = "".join(buffer).strip()
            if value:
                statements.append(value)
            buffer = []
        else:
            buffer.append(char)
        index += 1
    if quote:
        raise SqlGuardError("SQL contains an unterminated quoted string")
    if block_comment:
        raise SqlGuardError("SQL contains an unterminated block comment")
    value = "".join(buffer).strip()
    if value:
        statements.append(value)
    if not statements:
        raise SqlGuardError("No SQL statements were found")
    return statements


def finding(code: str, severity: str, message: str, statement: int) -> dict[str, object]:
    return {"code": code, "severity": severity, "message": message, "statement": statement}


def analyze(sql: str) -> dict[str, object]:
    statements = split_statements(sql)
    findings = []
    statement_reports = []
    for number, statement in enumerate(statements, start=1):
        normalized = re.sub(r"\s+", " ", statement).strip()
        upper = normalized.upper()
        first_match = re.match(r"^(?:WITH\b[\s\S]*?\)\s*)?([A-Z]+)\b", upper)
        statement_type = first_match.group(1) if first_match else "UNKNOWN"
        statement_reports.append({"number": number, "type": statement_type, "preview": normalized[:120]})

        if statement_type in {"DROP", "TRUNCATE"}:
            findings.append(finding("SQL001", "error", statement_type + " is destructive and requires explicit review", number))
        if statement_type in {"UPDATE", "DELETE"} and not re.search(r"\bWHERE\b", upper):
            findings.append(finding("SQL002", "error", statement_type + " has no WHERE clause", number))
        if re.search(r"\bSELECT\s+(?:DISTINCT\s+)?(?:[A-Z0-9_]+\.)?\*", upper):
            findings.append(finding("SQL003", "warning", "SELECT * hides the intended column contract", number))
        if re.search(r"(?:=|!=|<>)\s*NULL\b|\bNULL\s*(?:=|!=|<>)", upper):
            findings.append(finding("SQL004", "error", "Compare NULL with IS NULL or IS NOT NULL", number))
        if statement_type == "INSERT" and re.match(r"^INSERT\s+INTO\s+[A-Z0-9_.]+\s+VALUES\b", upper):
            findings.append(finding("SQL005", "warning", "INSERT should name its target columns", number))
        if statement_type == "SELECT" and not re.search(r"\bLIMIT\s+\d+\b|\bFETCH\s+(?:FIRST|NEXT)\b|\bTOP\s*\(?\d+", upper):
            aggregate_only = bool(re.match(r"^SELECT\s+(?:COUNT|SUM|AVG|MIN|MAX)\s*\(", upper))
            if not aggregate_only:
                findings.append(finding("SQL006", "warning", "Unbounded SELECT has no LIMIT, FETCH, or TOP clause", number))

    counts = {
        "error": sum(item["severity"] == "error" for item in findings),
        "warning": sum(item["severity"] == "warning" for item in findings),
    }
    return {
        "statement_count": len(statements),
        "finding_count": len(findings),
        "counts": counts,
        "statements": statement_reports,
        "findings": findings,
    }

