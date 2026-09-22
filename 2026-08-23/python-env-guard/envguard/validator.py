from __future__ import annotations
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from .parser import EnvError

TYPES = {"string", "integer", "number", "boolean", "url", "enum"}
PLACEHOLDERS = {"change-me", "changeme", "replace-me", "your-token-here", "secret", "password", "todo"}

def load_schema(path: str | Path) -> dict[str, dict[str, Any]]:
    try: raw = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error: raise EnvError(f"cannot read schema: {error}") from error
    if not isinstance(raw, dict) or not raw: raise EnvError("schema must be a non-empty JSON object")
    for key, rule in raw.items():
        if not isinstance(key, str) or not isinstance(rule, dict): raise EnvError("schema keys must map to rule objects")
        kind = rule.get("type", "string")
        if kind not in TYPES: raise EnvError(f"{key}: unsupported type {kind}")
        if kind == "enum" and (not isinstance(rule.get("enum"), list) or not rule["enum"]): raise EnvError(f"{key}: enum type requires a non-empty enum list")
        if "pattern" in rule:
            try: re.compile(rule["pattern"])
            except (TypeError, re.error) as error: raise EnvError(f"{key}: invalid pattern: {error}") from error
    return raw

def issue(key: str, code: str, message: str) -> dict[str, str]: return {"key": key, "code": code, "message": message}

def validate_value(key: str, value: str, rule: dict[str, Any]) -> list[dict[str, str]]:
    problems = []; kind = rule.get("type", "string")
    if rule.get("secret") and value.casefold() in PLACEHOLDERS: problems.append(issue(key, "placeholder_secret", "replace the placeholder with a real local secret"))
    if "min_length" in rule and len(value) < rule["min_length"]: problems.append(issue(key, "too_short", f"must contain at least {rule['min_length']} characters"))
    if "max_length" in rule and len(value) > rule["max_length"]: problems.append(issue(key, "too_long", f"must contain at most {rule['max_length']} characters"))
    if "pattern" in rule and not re.fullmatch(rule["pattern"], value): problems.append(issue(key, "pattern", "does not match the required pattern"))
    if kind == "boolean" and value.casefold() not in {"true", "false", "1", "0", "yes", "no"}: problems.append(issue(key, "type", "must be a boolean"))
    elif kind in {"integer", "number"}:
        try: number = int(value) if kind == "integer" else float(value)
        except ValueError: problems.append(issue(key, "type", f"must be an {kind}")); return problems
        if "min" in rule and number < rule["min"]: problems.append(issue(key, "minimum", f"must be at least {rule['min']}"))
        if "max" in rule and number > rule["max"]: problems.append(issue(key, "maximum", f"must be at most {rule['max']}"))
    elif kind == "url":
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc: problems.append(issue(key, "type", "must be an HTTP or HTTPS URL"))
    elif kind == "enum" and value not in rule["enum"]: problems.append(issue(key, "enum", f"must be one of: {', '.join(map(str, rule['enum']))}"))
    return problems

def validate_environment(values: dict[str, str], schema: dict[str, dict[str, Any]], allow_extra: bool = False) -> dict[str, Any]:
    problems = []
    for key, rule in schema.items():
        if key not in values:
            if rule.get("required", False): problems.append(issue(key, "missing", "required variable is missing"))
            continue
        problems.extend(validate_value(key, values[key], rule))
    if not allow_extra:
        for key in sorted(set(values) - set(schema)): problems.append(issue(key, "unexpected", "variable is not declared in the schema"))
    return {"valid": not problems, "checked": len(values), "declared": len(schema), "issue_count": len(problems), "issues": problems}

