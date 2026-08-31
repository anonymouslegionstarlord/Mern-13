"""Validation and execution for JSON-defined regular-expression cases."""

from __future__ import annotations

import json
import re
from pathlib import Path

FLAG_MAP = {"IGNORECASE": re.IGNORECASE, "MULTILINE": re.MULTILINE, "DOTALL": re.DOTALL, "ASCII": re.ASCII}
MODES = {"search": re.Pattern.search, "match": re.Pattern.match, "fullmatch": re.Pattern.fullmatch}


class RegexBenchError(ValueError):
    """Raised when a RegexBench configuration is invalid."""


def load_config(path: str | Path) -> object:
    source = Path(path)
    try:
        return json.loads(source.read_text(encoding="utf-8"))
    except OSError as exc:
        raise RegexBenchError("Could not read " + str(source) + ": " + str(exc)) from exc
    except json.JSONDecodeError as exc:
        raise RegexBenchError("Invalid JSON at line " + str(exc.lineno) + ", column " + str(exc.colno)) from exc


def validate(config: object) -> list[dict[str, object]]:
    if not isinstance(config, dict) or set(config) != {"patterns"}:
        raise RegexBenchError("Configuration must contain only a patterns array")
    patterns = config["patterns"]
    if not isinstance(patterns, list) or not patterns or len(patterns) > 100:
        raise RegexBenchError("patterns must contain 1-100 entries")
    names = set()
    normalized = []
    for index, item in enumerate(patterns, start=1):
        if not isinstance(item, dict):
            raise RegexBenchError("Pattern " + str(index) + " must be an object")
        unknown = sorted(set(item) - {"name", "pattern", "mode", "flags", "cases"})
        if unknown:
            raise RegexBenchError("Pattern " + str(index) + " has unknown fields: " + ", ".join(unknown))
        name = item.get("name")
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80:
            raise RegexBenchError("Pattern " + str(index) + " needs a 1-80 character name")
        name = name.strip()
        if name in names:
            raise RegexBenchError("Duplicate pattern name: " + name)
        names.add(name)
        source = item.get("pattern")
        if not isinstance(source, str) or not source or len(source) > 500:
            raise RegexBenchError(name + " pattern must contain 1-500 characters")
        mode = item.get("mode", "fullmatch")
        if mode not in MODES:
            raise RegexBenchError(name + " mode must be search, match, or fullmatch")
        raw_flags = item.get("flags", [])
        if not isinstance(raw_flags, list) or any(flag not in FLAG_MAP for flag in raw_flags) or len(raw_flags) != len(set(raw_flags)):
            raise RegexBenchError(name + " flags must be unique supported flag names")
        flags = 0
        for flag in raw_flags:
            flags |= FLAG_MAP[flag]
        try:
            compiled = re.compile(source, flags)
        except re.error as exc:
            raise RegexBenchError(name + " pattern is invalid: " + str(exc)) from exc
        cases = item.get("cases")
        if not isinstance(cases, list) or not cases or len(cases) > 500:
            raise RegexBenchError(name + " cases must contain 1-500 entries")
        clean_cases = []
        for case_index, case in enumerate(cases, start=1):
            if not isinstance(case, dict) or set(case) - {"label", "value", "should_match"}:
                raise RegexBenchError(name + " case " + str(case_index) + " has invalid fields")
            label = case.get("label")
            value = case.get("value")
            expected = case.get("should_match")
            if not isinstance(label, str) or not label.strip() or len(label.strip()) > 100:
                raise RegexBenchError(name + " case " + str(case_index) + " needs a label")
            if not isinstance(value, str) or len(value) > 2000:
                raise RegexBenchError(name + " case " + str(case_index) + " value must be text up to 2000 characters")
            if not isinstance(expected, bool):
                raise RegexBenchError(name + " case " + str(case_index) + " should_match must be true or false")
            clean_cases.append({"label": label.strip(), "value": value, "should_match": expected})
        normalized.append({"name": name, "source": source, "mode": mode, "flags": raw_flags, "compiled": compiled, "cases": clean_cases})
    return normalized


def run_config(config: object) -> dict[str, object]:
    patterns = validate(config)
    results = []
    passed = 0
    failed = 0
    for pattern in patterns:
        case_results = []
        matcher = MODES[pattern["mode"]]
        for case in pattern["cases"]:
            match = matcher(pattern["compiled"], case["value"])
            actual = match is not None
            ok = actual == case["should_match"]
            passed += int(ok)
            failed += int(not ok)
            case_results.append({
                "label": case["label"],
                "expected": case["should_match"],
                "actual": actual,
                "passed": ok,
                "matched_text": match.group(0) if match else None,
            })
        results.append({
            "name": pattern["name"],
            "pattern": pattern["source"],
            "mode": pattern["mode"],
            "flags": pattern["flags"],
            "passed": sum(case["passed"] for case in case_results),
            "failed": sum(not case["passed"] for case in case_results),
            "cases": case_results,
        })
    return {"pattern_count": len(results), "case_count": passed + failed, "passed": passed, "failed": failed, "patterns": results}
