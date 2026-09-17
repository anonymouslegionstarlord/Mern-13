"""Focused, deterministic comparison for OpenAPI 3 JSON documents."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from pathlib import Path
from typing import Any

MAX_BYTES = 2 * 1024 * 1024
MAX_PATHS = 1_000
MAX_OPERATIONS = 5_000
METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}
SEVERITY_ORDER = {"breaking": 0, "non-breaking": 1, "info": 2}


class SpecError(ValueError):
    """Raised when a document cannot be safely compared."""


@dataclass(frozen=True)
class Finding:
    severity: str
    code: str
    location: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass(frozen=True)
class Report:
    baseline_operations: int
    current_operations: int
    findings: tuple[Finding, ...]

    @property
    def breaking_count(self) -> int:
        return sum(item.severity == "breaking" for item in self.findings)

    @property
    def non_breaking_count(self) -> int:
        return sum(item.severity == "non-breaking" for item in self.findings)

    @property
    def info_count(self) -> int:
        return sum(item.severity == "info" for item in self.findings)

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": {
                "baseline_operations": self.baseline_operations,
                "current_operations": self.current_operations,
                "breaking": self.breaking_count,
                "non_breaking": self.non_breaking_count,
                "info": self.info_count,
                "compatible": self.breaking_count == 0,
            },
            "findings": [item.to_dict() for item in self.findings],
        }


def load_spec(filename: str | Path) -> dict[str, Any]:
    path = Path(filename)
    try:
        if path.is_symlink():
            raise SpecError(f"Symlink inputs are not allowed: {path}")
        if not path.is_file():
            raise SpecError(f"Input is not a regular file: {path}")
        size = path.stat().st_size
    except OSError as error:
        raise SpecError(f"Cannot inspect {path}: {error}") from error
    if size > MAX_BYTES:
        raise SpecError(f"Input exceeds the {MAX_BYTES}-byte limit: {path}")
    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        raise SpecError(f"Cannot read {path} as UTF-8: {error}") from error
    try:
        document = json.loads(content)
    except json.JSONDecodeError as error:
        raise SpecError(f"Invalid JSON in {path}: line {error.lineno}, column {error.colno}") from error
    _validate_document(document, str(path))
    return document


def _validate_document(document: Any, label: str) -> None:
    if not isinstance(document, dict):
        raise SpecError(f"{label} must contain a JSON object")
    version = document.get("openapi")
    if not isinstance(version, str) or not version.startswith("3."):
        raise SpecError(f"{label} must declare an OpenAPI 3.x version")
    paths = document.get("paths")
    if not isinstance(paths, dict):
        raise SpecError(f"{label} must contain a paths object")
    if len(paths) > MAX_PATHS:
        raise SpecError(f"{label} exceeds the {MAX_PATHS}-path limit")
    operation_count = 0
    for route, path_item in paths.items():
        if not isinstance(route, str) or not route.startswith("/"):
            raise SpecError(f"{label} contains an invalid path key")
        if not isinstance(path_item, dict):
            raise SpecError(f"Path {route} in {label} must be an object")
        for method, operation in path_item.items():
            if method.lower() in METHODS:
                operation_count += 1
                if not isinstance(operation, dict):
                    raise SpecError(f"Operation {method.upper()} {route} in {label} must be an object")
    if operation_count > MAX_OPERATIONS:
        raise SpecError(f"{label} exceeds the {MAX_OPERATIONS}-operation limit")


def _operation_count(document: dict[str, Any]) -> int:
    return sum(
        method.lower() in METHODS
        for path_item in document["paths"].values()
        for method in path_item
    )


def _parameters(path_item: dict[str, Any], operation: dict[str, Any]) -> dict[tuple[str, str], bool]:
    result: dict[tuple[str, str], bool] = {}
    for collection in (path_item.get("parameters", []), operation.get("parameters", [])):
        if not isinstance(collection, list):
            continue
        for parameter in collection:
            if not isinstance(parameter, dict) or "$ref" in parameter:
                continue
            name = parameter.get("name")
            location = parameter.get("in")
            if isinstance(name, str) and isinstance(location, str):
                required = bool(parameter.get("required")) or location == "path"
                result[(location, name)] = required
    return result


def _responses(operation: dict[str, Any]) -> dict[str, Any]:
    responses = operation.get("responses", {})
    return responses if isinstance(responses, dict) else {}


def _success_codes(operation: dict[str, Any]) -> set[str]:
    return {
        str(code)
        for code in _responses(operation)
        if len(str(code)) == 3 and str(code).upper().startswith("2")
    }


def _json_schema_type(response: Any) -> str | None:
    if not isinstance(response, dict) or "$ref" in response:
        return None
    content = response.get("content")
    if not isinstance(content, dict):
        return None
    media = content.get("application/json")
    if not isinstance(media, dict):
        return None
    schema = media.get("schema")
    if not isinstance(schema, dict) or "$ref" in schema:
        return None
    value = schema.get("type")
    return value if isinstance(value, str) else None


def _request_body_required(operation: dict[str, Any]) -> bool:
    body = operation.get("requestBody")
    return isinstance(body, dict) and "$ref" not in body and bool(body.get("required"))


def compare_specs(baseline: dict[str, Any], current: dict[str, Any]) -> Report:
    _validate_document(baseline, "baseline")
    _validate_document(current, "current")
    findings: list[Finding] = []
    old_paths = baseline["paths"]
    new_paths = current["paths"]

    for route in sorted(set(old_paths) - set(new_paths)):
        findings.append(Finding("breaking", "path-removed", route, f"Path {route} was removed"))
    for route in sorted(set(new_paths) - set(old_paths)):
        findings.append(Finding("non-breaking", "path-added", route, f"Path {route} was added"))

    for route in sorted(set(old_paths) & set(new_paths)):
        old_item = old_paths[route]
        new_item = new_paths[route]
        old_methods = {name.lower() for name in old_item if name.lower() in METHODS}
        new_methods = {name.lower() for name in new_item if name.lower() in METHODS}
        for method in sorted(old_methods - new_methods):
            location = f"{method.upper()} {route}"
            findings.append(Finding("breaking", "operation-removed", location, f"Operation {location} was removed"))
        for method in sorted(new_methods - old_methods):
            location = f"{method.upper()} {route}"
            findings.append(Finding("non-breaking", "operation-added", location, f"Operation {location} was added"))

        for method in sorted(old_methods & new_methods):
            location = f"{method.upper()} {route}"
            old_operation = old_item[method]
            new_operation = new_item[method]
            old_parameters = _parameters(old_item, old_operation)
            new_parameters = _parameters(new_item, new_operation)
            for identity, required in sorted(new_parameters.items()):
                old_required = old_parameters.get(identity)
                parameter_location, name = identity
                label = f"{parameter_location} parameter {name}"
                if required and old_required is not True:
                    findings.append(Finding(
                        "breaking", "parameter-required", location,
                        f"{label} is newly required",
                    ))
                elif identity not in old_parameters:
                    findings.append(Finding(
                        "non-breaking", "parameter-added", location,
                        f"Optional {label} was added",
                    ))

            if not _request_body_required(old_operation) and _request_body_required(new_operation):
                findings.append(Finding(
                    "breaking", "request-body-required", location,
                    "The request body is newly required",
                ))

            old_success = _success_codes(old_operation)
            new_success = _success_codes(new_operation)
            for code in sorted(old_success - new_success):
                findings.append(Finding(
                    "breaking", "success-response-removed", location,
                    f"Successful response {code} was removed",
                ))
            for code in sorted(new_success - old_success):
                findings.append(Finding(
                    "non-breaking", "success-response-added", location,
                    f"Successful response {code} was added",
                ))
            old_responses = _responses(old_operation)
            new_responses = _responses(new_operation)
            for code in sorted(old_success & new_success):
                old_type = _json_schema_type(old_responses.get(code))
                new_type = _json_schema_type(new_responses.get(code))
                if old_type and new_type and old_type != new_type:
                    findings.append(Finding(
                        "breaking", "response-type-changed", location,
                        f"Response {code} JSON type changed from {old_type} to {new_type}",
                    ))

            if not bool(old_operation.get("deprecated")) and bool(new_operation.get("deprecated")):
                findings.append(Finding(
                    "info", "operation-deprecated", location,
                    f"Operation {location} is now deprecated",
                ))

    findings.sort(key=lambda item: (SEVERITY_ORDER[item.severity], item.location, item.code, item.message))
    return Report(_operation_count(baseline), _operation_count(current), tuple(findings))


def compare_files(baseline: str | Path, current: str | Path) -> Report:
    return compare_specs(load_spec(baseline), load_spec(current))

