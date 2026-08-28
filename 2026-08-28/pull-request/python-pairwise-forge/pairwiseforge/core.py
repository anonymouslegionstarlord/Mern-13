"""Validation and deterministic pairwise test-case generation."""

from __future__ import annotations

import csv
import io
import itertools
import json
import math
from pathlib import Path
from typing import Any

MAX_CANDIDATES = 100_000


class ConfigError(ValueError):
    """Raised when a parameter model cannot be safely generated."""


def canonical(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def valid_scalar(value: object) -> bool:
    if value is None or isinstance(value, (str, bool, int)):
        return True
    return isinstance(value, float) and math.isfinite(value)


def validate_config(config: object) -> tuple[dict[str, list[object]], list[dict[str, object]]]:
    if not isinstance(config, dict):
        raise ConfigError("Configuration must be a JSON object")
    unknown = sorted(set(config) - {"parameters", "exclude"})
    if unknown:
        raise ConfigError("Unknown top-level fields: " + ", ".join(unknown))
    raw_parameters = config.get("parameters")
    if not isinstance(raw_parameters, dict) or not raw_parameters:
        raise ConfigError("parameters must be a non-empty object")
    if len(raw_parameters) > 20:
        raise ConfigError("At most 20 parameters are allowed")

    parameters: dict[str, list[object]] = {}
    for name, values in raw_parameters.items():
        if not isinstance(name, str) or not name or len(name) > 40 or not name.replace("_", "").replace("-", "").isalnum() or not name[0].isalpha():
            raise ConfigError("Parameter names must start with a letter and use 1-40 letters, numbers, underscores, or hyphens")
        if not isinstance(values, list) or not values or len(values) > 50:
            raise ConfigError(name + " must contain 1-50 values")
        encoded = []
        for value in values:
            if not valid_scalar(value):
                raise ConfigError(name + " values must be JSON strings, numbers, booleans, or null")
            encoded.append(canonical(value))
        if len(encoded) != len(set(encoded)):
            raise ConfigError(name + " contains duplicate values")
        parameters[name] = list(values)

    raw_exclusions = config.get("exclude", [])
    if not isinstance(raw_exclusions, list) or len(raw_exclusions) > 1_000:
        raise ConfigError("exclude must be a list with at most 1000 rules")
    exclusions: list[dict[str, object]] = []
    for index, rule in enumerate(raw_exclusions, start=1):
        if not isinstance(rule, dict) or not rule:
            raise ConfigError("Exclusion " + str(index) + " must be a non-empty object")
        unknown_names = sorted(set(rule) - set(parameters))
        if unknown_names:
            raise ConfigError("Exclusion " + str(index) + " has unknown parameters: " + ", ".join(unknown_names))
        normalized = {}
        for name, value in rule.items():
            if not valid_scalar(value) or canonical(value) not in {canonical(item) for item in parameters[name]}:
                raise ConfigError("Exclusion " + str(index) + " uses an unknown value for " + name)
            normalized[name] = value
        exclusions.append(normalized)
    return parameters, exclusions


def excluded(case: dict[str, object], rules: list[dict[str, object]]) -> bool:
    return any(all(canonical(case[name]) == canonical(value) for name, value in rule.items()) for rule in rules)


def case_pairs(case: dict[str, object], names: list[str]) -> set[tuple[str, str, str, str]]:
    return {
        (left, canonical(case[left]), right, canonical(case[right]))
        for left, right in itertools.combinations(names, 2)
    }


def generate(config: object) -> dict[str, Any]:
    parameters, exclusions = validate_config(config)
    names = list(parameters)
    candidate_count = math.prod(len(values) for values in parameters.values())
    if candidate_count > MAX_CANDIDATES:
        raise ConfigError("Cartesian space has " + str(candidate_count) + " candidates; limit is " + str(MAX_CANDIDATES))

    candidates = [
        dict(zip(names, values))
        for values in itertools.product(*(parameters[name] for name in names))
    ]
    candidates = [case for case in candidates if not excluded(case, exclusions)]
    if not candidates:
        raise ConfigError("Exclusions remove every possible test case")

    unreachable = []
    for name, values in parameters.items():
        reached = {canonical(case[name]) for case in candidates}
        unreachable.extend(name + "=" + canonical(value) for value in values if canonical(value) not in reached)
    if unreachable:
        raise ConfigError("Exclusions make values unreachable: " + ", ".join(unreachable))

    if len(names) == 1:
        cases = candidates
        pair_count = 0
    else:
        pairs_by_case = {canonical(case): case_pairs(case, names) for case in candidates}
        remaining = set().union(*pairs_by_case.values())
        pair_count = len(remaining)
        available = sorted(candidates, key=canonical)
        cases = []
        while remaining:
            best = max(available, key=lambda case: len(pairs_by_case[canonical(case)] & remaining))
            covered = pairs_by_case[canonical(best)] & remaining
            if not covered:
                raise ConfigError("Could not cover every achievable pair")
            cases.append(best)
            remaining -= covered
            available.remove(best)

    return {
        "parameter_count": len(names),
        "candidate_count": len(candidates),
        "pair_count": pair_count,
        "case_count": len(cases),
        "coverage_percent": 100,
        "parameters": names,
        "cases": cases,
    }


def load_config(path: str | Path) -> object:
    source = Path(path)
    try:
        return json.loads(source.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ConfigError("Could not read " + str(source) + ": " + str(exc)) from exc
    except json.JSONDecodeError as exc:
        raise ConfigError("Invalid JSON in " + str(source) + " at line " + str(exc.lineno) + ", column " + str(exc.colno)) from exc


def render_csv(report: dict[str, Any]) -> str:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=report["parameters"])
    writer.writeheader()
    writer.writerows(report["cases"])
    return output.getvalue()

