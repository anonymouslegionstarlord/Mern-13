"""Conventional Commit parsing and release-note rendering."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Iterable

TYPES = ("feat", "fix", "perf", "refactor", "docs", "test", "build", "ci", "chore", "style", "revert")
GROUPS = (
    ("Features", {"feat"}),
    ("Fixes", {"fix"}),
    ("Performance", {"perf"}),
    ("Refactoring", {"refactor"}),
    ("Documentation", {"docs"}),
    ("Tests", {"test"}),
    ("Maintenance", {"build", "ci", "chore", "style", "revert"}),
)
PATTERN = re.compile(
    r"^(?P<type>[a-z]+)(?:\((?P<scope>[A-Za-z0-9._/-]{1,60})\))?(?P<breaking>!)?: (?P<description>\S.{1,198})$"
)


class CommitError(ValueError):
    """Raised for invalid commit input or filters."""


@dataclass(frozen=True, slots=True)
class Commit:
    type: str
    scope: str | None
    description: str
    breaking: bool
    raw: str


def parse_commit(line: str) -> Commit:
    raw = line.strip()
    match = PATTERN.fullmatch(raw)
    if not match:
        raise CommitError("Expected type(scope): description")
    commit_type = match.group("type")
    if commit_type not in TYPES:
        raise CommitError("Unsupported commit type " + commit_type)
    description = match.group("description").strip()
    if description.endswith("."):
        description = description[:-1].rstrip()
    return Commit(
        type=commit_type,
        scope=match.group("scope"),
        description=description,
        breaking=bool(match.group("breaking")),
        raw=raw,
    )


def parse_lines(lines: Iterable[str], *, allow_unparsed: bool = False) -> tuple[list[Commit], list[str]]:
    commits = []
    warnings = []
    for number, line in enumerate(lines, start=1):
        value = line.strip()
        if not value or value.startswith("#"):
            continue
        try:
            commits.append(parse_commit(value))
        except CommitError as exc:
            message = "line " + str(number) + ": " + str(exc) + " [" + value[:80] + "]"
            if not allow_unparsed:
                raise CommitError(message) from exc
            warnings.append(message)
    if not commits:
        raise CommitError("No valid commit lines were found")
    return commits, warnings


def build_report(
    commits: Iterable[Commit],
    *,
    title: str = "Release notes",
    include_types: Iterable[str] = (),
    include_scopes: Iterable[str] = (),
) -> dict[str, object]:
    clean_title = title.strip()
    if not clean_title or len(clean_title) > 120:
        raise CommitError("Title must contain 1-120 characters")
    type_filter = set(include_types)
    scope_filter = set(include_scopes)
    unknown = sorted(type_filter - set(TYPES))
    if unknown:
        raise CommitError("Unknown type filters: " + ", ".join(unknown))
    selected = [
        commit for commit in commits
        if (not type_filter or commit.type in type_filter)
        and (not scope_filter or commit.scope in scope_filter)
    ]
    if not selected:
        raise CommitError("No commits match the selected filters")

    breaking = [asdict(commit) for commit in selected if commit.breaking]
    sections = []
    for label, types in GROUPS:
        entries = [asdict(commit) for commit in selected if commit.type in types]
        if entries:
            sections.append({"name": label, "entries": entries})
    return {
        "title": clean_title,
        "commit_count": len(selected),
        "breaking_count": len(breaking),
        "breaking_changes": breaking,
        "sections": sections,
    }


def bullet(entry: dict[str, object]) -> str:
    scope = " **" + str(entry["scope"]) + ":**" if entry["scope"] else ""
    marker = " **BREAKING**" if entry["breaking"] else ""
    return "-" + scope + " " + str(entry["description"]) + marker


def render_markdown(report: dict[str, object]) -> str:
    lines = ["# " + str(report["title"]), ""]
    if report["breaking_changes"]:
        lines.extend(["## Breaking changes", ""])
        lines.extend(bullet(entry) for entry in report["breaking_changes"])
        lines.append("")
    for section in report["sections"]:
        lines.extend(["## " + section["name"], ""])
        lines.extend(bullet(entry) for entry in section["entries"])
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"

