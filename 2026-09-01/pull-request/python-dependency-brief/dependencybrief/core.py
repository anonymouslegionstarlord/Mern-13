"""Read direct dependency declarations without installing or contacting registries."""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import json
import re
import tomllib

MAX_FILE_BYTES = 1024 * 1024
MAX_DEPENDENCIES = 500
SUPPORTED_FILES = ("requirements.txt", "pyproject.toml", "package.json")
PYTHON_NAME = re.compile(r"^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]+\])?\s*(.*)$")


def _finding(severity: str, code: str, message: str, source: str) -> dict[str, str]:
    return {"severity": severity, "code": code, "message": message, "source": source}


def _read_text(path: Path) -> str:
    try:
        size = path.stat().st_size
    except OSError as exc:
        raise ValueError(f"Could not inspect {path}: {exc}") from exc
    if size > MAX_FILE_BYTES:
        raise ValueError(f"{path.name} exceeds the {MAX_FILE_BYTES}-byte safety limit")
    try:
        return path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeError) as exc:
        raise ValueError(f"Could not read {path}: {exc}") from exc


def _normalize(name: str, ecosystem: str) -> str:
    if ecosystem == "python":
        return re.sub(r"[-_.]+", "-", name).lower()
    return name.lower()


def _classify_python(specification: str) -> str:
    version_part = specification.split(";", 1)[0].strip()
    lowered = version_part.lower()
    if not version_part:
        return "unpinned"
    if lowered.startswith("@") or any(token in lowered for token in ("://", "git+", "file:", "../", "./")):
        return "direct"
    if re.fullmatch(r"==\s*[^*,\s]+", version_part):
        return "pinned"
    if "*" in version_part:
        return "unpinned"
    return "range"


def _classify_javascript(specification: str) -> str:
    value = specification.strip().lower()
    if value in ("", "*", "latest", "next"):
        return "unpinned"
    if any(value.startswith(prefix) for prefix in ("file:", "git:", "git+", "http:", "https:", "github:", "workspace:", "link:")):
        return "direct"
    if re.fullmatch(r"=?v?\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?", value):
        return "pinned"
    return "range"


def _dependency(ecosystem: str, group: str, name: str, specification: str, source: str) -> dict[str, str]:
    status = _classify_python(specification) if ecosystem == "python" else _classify_javascript(specification)
    return {
        "ecosystem": ecosystem,
        "group": group,
        "name": name,
        "normalized_name": _normalize(name, ecosystem),
        "specification": specification or "(none)",
        "status": status,
        "source": source,
    }


def _parse_python_declaration(value: str, group: str, source: str, findings: list[dict]) -> dict | None:
    declaration = value.strip()
    if not declaration:
        return None
    if declaration.startswith(("-r ", "--requirement ", "-c ", "--constraint ")):
        findings.append(_finding("error", "unsupported-include", "Included requirement files are not followed", source))
        return None
    if declaration.startswith("-e "):
        target = declaration[3:].strip()
        return _dependency("python", group, "editable-target", "@ " + target, source)
    if "://" in declaration and " @ " not in declaration:
        name = Path(declaration.split("#", 1)[0].rstrip("/")).name or "direct-url"
        return _dependency("python", group, name, "@ " + declaration, source)
    match = PYTHON_NAME.fullmatch(declaration)
    if not match:
        findings.append(_finding("error", "invalid-declaration", "Could not parse dependency declaration: " + declaration[:120], source))
        return None
    return _dependency("python", group, match.group(1), match.group(2).strip(), source)


def _parse_requirements(path: Path, findings: list[dict]) -> list[dict]:
    rows = []
    source = path.name
    for line_number, raw_line in enumerate(_read_text(path).splitlines(), 1):
        line = re.split(r"\s+#", raw_line, maxsplit=1)[0].strip()
        if not line or line.startswith("#"):
            continue
        row = _parse_python_declaration(line, "runtime", source + ":" + str(line_number), findings)
        if row:
            rows.append(row)
    return rows


def _parse_pyproject(path: Path, findings: list[dict]) -> list[dict]:
    try:
        data = tomllib.loads(_read_text(path))
    except tomllib.TOMLDecodeError as exc:
        findings.append(_finding("error", "invalid-toml", "Could not parse pyproject.toml: " + str(exc), path.name))
        return []
    project = data.get("project", {})
    if not isinstance(project, dict):
        findings.append(_finding("error", "invalid-project-table", "project must be a TOML table", path.name))
        return []
    rows = []
    dependencies = project.get("dependencies", [])
    if not isinstance(dependencies, list):
        findings.append(_finding("error", "invalid-dependency-list", "project.dependencies must be a list", path.name))
    else:
        for index, value in enumerate(dependencies, 1):
            if not isinstance(value, str):
                findings.append(_finding("error", "invalid-declaration", "Python dependency entries must be strings", path.name))
                continue
            row = _parse_python_declaration(value, "runtime", path.name + ":project.dependencies[" + str(index) + "]", findings)
            if row:
                rows.append(row)
    optional = project.get("optional-dependencies", {})
    if not isinstance(optional, dict):
        findings.append(_finding("error", "invalid-optional-table", "project.optional-dependencies must be a table", path.name))
    else:
        for group, values in optional.items():
            if not isinstance(values, list):
                findings.append(_finding("error", "invalid-dependency-list", "Optional dependency group " + str(group) + " must be a list", path.name))
                continue
            for index, value in enumerate(values, 1):
                if not isinstance(value, str):
                    findings.append(_finding("error", "invalid-declaration", "Python dependency entries must be strings", path.name))
                    continue
                row = _parse_python_declaration(value, "optional:" + str(group), path.name + ":" + str(group) + "[" + str(index) + "]", findings)
                if row:
                    rows.append(row)
    return rows


def _parse_package_json(path: Path, findings: list[dict]) -> list[dict]:
    try:
        data = json.loads(_read_text(path))
    except json.JSONDecodeError as exc:
        findings.append(_finding("error", "invalid-json", "Could not parse package.json: " + str(exc), path.name))
        return []
    if not isinstance(data, dict):
        findings.append(_finding("error", "invalid-package-object", "package.json must contain an object", path.name))
        return []
    rows = []
    for group in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        values = data.get(group, {})
        if not isinstance(values, dict):
            findings.append(_finding("error", "invalid-dependency-map", group + " must be an object", path.name))
            continue
        for name, specification in sorted(values.items()):
            if not isinstance(specification, str) or not isinstance(name, str) or not name.strip():
                findings.append(_finding("error", "invalid-declaration", group + " entries must map package names to strings", path.name))
                continue
            rows.append(_dependency("javascript", group, name, specification, path.name + ":" + group))
    return rows


def _manifest_paths(target: Path) -> list[Path]:
    if target.is_file():
        if target.name not in SUPPORTED_FILES:
            raise ValueError("Supported files are: " + ", ".join(SUPPORTED_FILES))
        return [target]
    if not target.is_dir():
        raise ValueError("Target does not exist or is not accessible: " + str(target))
    paths = [target / name for name in SUPPORTED_FILES if (target / name).is_file()]
    if not paths:
        raise ValueError("No supported manifests found in " + str(target))
    return paths


def analyze_path(target: str | Path) -> dict:
    """Analyze direct dependency declarations in one file or a directory root."""
    root = Path(target)
    paths = _manifest_paths(root)
    dependencies: list[dict] = []
    findings: list[dict] = []
    for path in paths:
        try:
            if path.name == "requirements.txt":
                dependencies.extend(_parse_requirements(path, findings))
            elif path.name == "pyproject.toml":
                dependencies.extend(_parse_pyproject(path, findings))
            else:
                dependencies.extend(_parse_package_json(path, findings))
        except ValueError as exc:
            findings.append(_finding("error", "unreadable-manifest", str(exc), path.name))

    if len(dependencies) > MAX_DEPENDENCIES:
        findings.append(_finding("error", "dependency-limit", f"Found more than {MAX_DEPENDENCIES} direct dependencies", str(root)))
        dependencies = dependencies[:MAX_DEPENDENCIES]

    for row in dependencies:
        if row["status"] == "unpinned":
            findings.append(_finding("warning", "unpinned-dependency", row["name"] + " has no bounded version", row["source"]))
        elif row["status"] == "direct":
            findings.append(_finding("warning", "direct-source", row["name"] + " uses a URL, VCS, workspace, or local source", row["source"]))

    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in dependencies:
        grouped[(row["ecosystem"], row["normalized_name"])].append(row)
    for (_ecosystem, _name), rows in grouped.items():
        specs = {row["specification"] for row in rows}
        if len(rows) > 1 and len(specs) > 1:
            findings.append(_finding("warning", "conflicting-declarations", rows[0]["name"] + " has multiple specifications: " + ", ".join(sorted(specs)), rows[0]["source"]))

    status_counts = {"pinned": 0, "range": 0, "unpinned": 0, "direct": 0}
    ecosystem_counts = {"python": 0, "javascript": 0}
    for row in dependencies:
        status_counts[row["status"]] += 1
        ecosystem_counts[row["ecosystem"]] += 1
    finding_counts = {"error": 0, "warning": 0}
    for finding in findings:
        finding_counts[finding["severity"]] += 1

    return {
        "target": str(root),
        "manifests": [path.name for path in paths],
        "status": "error" if finding_counts["error"] else "warning" if finding_counts["warning"] else "ok",
        "summary": {"total": len(dependencies), "by_status": status_counts, "by_ecosystem": ecosystem_counts},
        "counts": finding_counts,
        "dependencies": dependencies,
        "findings": findings,
        "notice": "This is a direct-declaration inventory; it does not resolve registries, lockfiles, or transitive packages.",
    }
