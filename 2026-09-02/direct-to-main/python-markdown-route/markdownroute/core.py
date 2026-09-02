"""Validate common inline Markdown links without fetching external pages."""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re

MAX_FILE_BYTES = 1024 * 1024
MAX_MARKDOWN_FILES = 250
SKIP_PARTS = {"node_modules", ".git", ".venv", "venv", "dist", "build"}
LINK_PATTERN = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
HEADING_PATTERN = re.compile(r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$")
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
PUNCTUATION_PATTERN = re.compile(r"[^\w\s-]", re.UNICODE)


def _finding(severity: str, code: str, message: str, source: str, line: int | None = None) -> dict:
    row = {"severity": severity, "code": code, "message": message, "source": source}
    if line is not None:
        row["line"] = line
    return row


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


def _slugify(heading: str) -> str:
    value = re.sub(r"[`*_~]", "", heading)
    value = HTML_TAG_PATTERN.sub("", value).strip().lower()
    value = PUNCTUATION_PATTERN.sub("", value)
    return re.sub(r"[\s-]+", "-", value).strip("-")


def _anchors(text: str) -> set[str]:
    anchors: set[str] = set()
    occurrences: dict[str, int] = defaultdict(int)
    fenced = False
    fence_marker = ""
    for line in text.splitlines():
        stripped = line.lstrip()
        if stripped.startswith(("```", "~~~")):
            marker = stripped[:3]
            if not fenced:
                fenced = True
                fence_marker = marker
            elif marker == fence_marker:
                fenced = False
            continue
        if fenced:
            continue
        match = HEADING_PATTERN.match(line)
        if not match:
            continue
        base = _slugify(match.group(2))
        if not base:
            continue
        count = occurrences[base]
        occurrences[base] += 1
        anchors.add(base if count == 0 else base + "-" + str(count))
    return anchors


def _links(text: str) -> list[tuple[int, str]]:
    rows = []
    fenced = False
    fence_marker = ""
    for line_number, line in enumerate(text.splitlines(), 1):
        stripped = line.lstrip()
        if stripped.startswith(("```", "~~~")):
            marker = stripped[:3]
            if not fenced:
                fenced = True
                fence_marker = marker
            elif marker == fence_marker:
                fenced = False
            continue
        if fenced:
            continue
        rows.extend((line_number, match.group(1).strip()) for match in LINK_PATTERN.finditer(line))
    return rows


def _destination(raw: str) -> str:
    if raw.startswith("<"):
        closing = raw.find(">")
        return raw[1:closing] if closing >= 0 else raw[1:]
    return raw.split(maxsplit=1)[0] if raw else ""


def _collect_files(target: Path) -> tuple[Path, list[Path]]:
    if target.is_file():
        if target.suffix.lower() != ".md":
            raise ValueError("Target file must use the .md extension")
        return target.parent.resolve(), [target.resolve()]
    if not target.is_dir():
        raise ValueError("Target does not exist or is not accessible: " + str(target))
    root = target.resolve()
    files = []
    for path in sorted(root.rglob("*.md")):
        relative_parts = path.relative_to(root).parts
        if any(part in SKIP_PARTS or part.startswith(".") for part in relative_parts[:-1]):
            continue
        files.append(path.resolve())
    if not files:
        raise ValueError("No Markdown files found in " + str(target))
    if len(files) > MAX_MARKDOWN_FILES:
        raise ValueError(f"Found more than {MAX_MARKDOWN_FILES} Markdown files")
    return root, files


def audit_markdown(target: str | Path) -> dict:
    """Audit local Markdown destinations and heading fragments under a safe root."""
    root, files = _collect_files(Path(target))
    findings: list[dict] = []
    text_cache: dict[Path, str] = {}
    anchor_cache: dict[Path, set[str]] = {}
    local_links = 0
    external_links = 0

    def source_name(path: Path) -> str:
        return path.relative_to(root).as_posix()

    def load(path: Path) -> str | None:
        if path in text_cache:
            return text_cache[path]
        try:
            text_cache[path] = _read_text(path)
            return text_cache[path]
        except ValueError as exc:
            findings.append(_finding("error", "unreadable-file", str(exc), source_name(path)))
            return None

    for source in files:
        text = load(source)
        if text is None:
            continue
        for line_number, raw_target in _links(text):
            destination = _destination(raw_target)
            if not destination:
                findings.append(_finding("warning", "empty-destination", "Link destination is empty", source_name(source), line_number))
                continue
            parts = urlsplit(destination)
            if parts.scheme.lower() in {"http", "https", "mailto", "tel"} or destination.startswith("//"):
                external_links += 1
                continue
            if parts.scheme:
                findings.append(_finding("warning", "unsupported-scheme", "Link scheme is not checked: " + parts.scheme, source_name(source), line_number))
                continue
            local_links += 1
            decoded_path = unquote(parts.path)
            fragment = unquote(parts.fragment).lower()
            if "\x00" in decoded_path:
                findings.append(_finding("error", "invalid-path", "Link path contains a null byte", source_name(source), line_number))
                continue
            if decoded_path.startswith("/"):
                findings.append(_finding("warning", "absolute-path", "Root-relative links are not portable and are not resolved", source_name(source), line_number))
                continue
            candidate = (source.parent / decoded_path).resolve() if decoded_path else source
            try:
                candidate.relative_to(root)
            except ValueError:
                findings.append(_finding("error", "root-escape", "Link resolves outside the audited root", source_name(source), line_number))
                continue
            if not candidate.exists():
                findings.append(_finding("error", "missing-target", "Local target does not exist: " + decoded_path, source_name(source), line_number))
                continue
            if fragment and candidate.is_file() and candidate.suffix.lower() == ".md":
                target_text = load(candidate)
                if target_text is None:
                    continue
                if candidate not in anchor_cache:
                    anchor_cache[candidate] = _anchors(target_text)
                if fragment not in anchor_cache[candidate]:
                    findings.append(_finding("error", "missing-anchor", "Heading fragment does not exist: #" + fragment, source_name(source), line_number))

    counts = {"error": 0, "warning": 0}
    for finding in findings:
        counts[finding["severity"]] += 1
    return {
        "target": str(target),
        "status": "error" if counts["error"] else "warning" if counts["warning"] else "ok",
        "summary": {"files": len(files), "local_links": local_links, "external_links": external_links},
        "files": [source_name(path) for path in files],
        "counts": counts,
        "findings": findings,
        "notice": "External destinations are counted but never fetched; heading slugs follow a practical GitHub-style approximation.",
    }
