"""Nested JSON locale loading and parity comparison."""

from __future__ import annotations

import json
import re
from pathlib import Path

BRACE_PLACEHOLDER = re.compile(r"(?<!\{)\{([A-Za-z_][A-Za-z0-9_]*)\}(?!\})")
PERCENT_PLACEHOLDER = re.compile(r"%\(([A-Za-z_][A-Za-z0-9_]*)\)([diouxXeEfFgGcrs%])")


class LocaleError(ValueError):
    """Raised when a locale file cannot be safely compared."""


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise LocaleError("Duplicate JSON key: " + key)
        result[key] = value
    return result


def load_locale(path: str | Path) -> dict[str, object]:
    source = Path(path)
    try:
        data = json.loads(source.read_text(encoding="utf-8"), object_pairs_hook=unique_object)
    except OSError as exc:
        raise LocaleError("Could not read " + str(source) + ": " + str(exc)) from exc
    except json.JSONDecodeError as exc:
        raise LocaleError("Invalid JSON in " + str(source) + " at line " + str(exc.lineno) + ", column " + str(exc.colno)) from exc
    if not isinstance(data, dict) or not data:
        raise LocaleError(str(source) + " must contain a non-empty JSON object")
    return data


def flatten(value: object, prefix: str = "") -> dict[str, object]:
    if not isinstance(value, dict):
        return {prefix: value}
    result = {}
    for key, child in value.items():
        if not isinstance(key, str) or not key:
            raise LocaleError("Locale object keys must be non-empty strings")
        path = key if not prefix else prefix + "." + key
        if isinstance(child, dict) and not child:
            result[path] = child
        else:
            result.update(flatten(child, path))
    return result


def placeholders(value: str) -> set[str]:
    return {"{" + name + "}" for name in BRACE_PLACEHOLDER.findall(value)} | {"%(" + name + ")" + kind for name, kind in PERCENT_PLACEHOLDER.findall(value)}


def type_name(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    return type(value).__name__


def compare(reference: dict[str, object], target: dict[str, object], *, target_name: str = "target") -> dict[str, object]:
    base = flatten(reference)
    translated = flatten(target)
    findings = []
    for key in sorted(set(base) - set(translated)):
        findings.append({"severity": "error", "code": "LOC001", "key": key, "message": "Missing translation key"})
    for key in sorted(set(translated) - set(base)):
        findings.append({"severity": "error", "code": "LOC002", "key": key, "message": "Extra translation key"})
    for key in sorted(set(base) & set(translated)):
        expected, actual = base[key], translated[key]
        if type_name(expected) != type_name(actual):
            findings.append({"severity": "error", "code": "LOC003", "key": key, "message": "Type mismatch: expected " + type_name(expected) + ", found " + type_name(actual)})
            continue
        if isinstance(expected, str) and isinstance(actual, str):
            expected_tokens, actual_tokens = placeholders(expected), placeholders(actual)
            if expected_tokens != actual_tokens:
                findings.append({"severity": "error", "code": "LOC004", "key": key, "message": "Placeholder mismatch: expected " + str(sorted(expected_tokens)) + ", found " + str(sorted(actual_tokens))})
            if not actual.strip():
                findings.append({"severity": "warning", "code": "LOC005", "key": key, "message": "Translation is empty"})
    return {
        "target": target_name,
        "reference_keys": len(base),
        "target_keys": len(translated),
        "errors": sum(item["severity"] == "error" for item in findings),
        "warnings": sum(item["severity"] == "warning" for item in findings),
        "findings": findings,
    }
