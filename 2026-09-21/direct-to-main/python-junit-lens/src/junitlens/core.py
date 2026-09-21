"""Safe, bounded JUnit XML parsing and aggregation."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import math
from pathlib import Path
from typing import Iterable
import xml.etree.ElementTree as ET

MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_FILES = 100
MAX_EXECUTIONS = 50_000


class ReportError(ValueError):
    """Raised when JUnit input cannot be analyzed safely."""


@dataclass(frozen=True)
class Execution:
    test_id: str
    suite: str
    name: str
    status: str
    seconds: float
    source: str

    def to_dict(self) -> dict[str, str | float]:
        return asdict(self)


@dataclass(frozen=True)
class Report:
    executions: tuple[Execution, ...]
    slow_seconds: float

    @property
    def status_counts(self) -> dict[str, int]:
        counts = {"passed": 0, "failed": 0, "error": 0, "skipped": 0}
        for item in self.executions:
            counts[item.status] += 1
        return counts

    @property
    def flaky_tests(self) -> tuple[str, ...]:
        outcomes: dict[str, set[str]] = {}
        for item in self.executions:
            outcomes.setdefault(item.test_id, set()).add(item.status)
        return tuple(sorted(
            test_id for test_id, statuses in outcomes.items()
            if "passed" in statuses and bool(statuses & {"failed", "error"})
        ))

    @property
    def slow_tests(self) -> tuple[Execution, ...]:
        return tuple(sorted(
            (item for item in self.executions if item.seconds >= self.slow_seconds),
            key=lambda item: (-item.seconds, item.test_id, item.source),
        ))

    def to_dict(self) -> dict:
        counts = self.status_counts
        total_seconds = round(sum(item.seconds for item in self.executions), 6)
        return {
            "summary": {
                "executions": len(self.executions),
                **counts,
                "flaky_candidates": len(self.flaky_tests),
                "slow_executions": len(self.slow_tests),
                "total_seconds": total_seconds,
            },
            "flaky_tests": list(self.flaky_tests),
            "slow_tests": [item.to_dict() for item in self.slow_tests],
        }


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _status(case: ET.Element) -> str:
    children = {_local(child.tag) for child in case}
    if "error" in children:
        return "error"
    if "failure" in children:
        return "failed"
    if "skipped" in children:
        return "skipped"
    return "passed"


def parse_report(filename: str | Path) -> tuple[Execution, ...]:
    path = Path(filename)
    try:
        if path.is_symlink():
            raise ReportError(f"Symlink inputs are not allowed: {path}")
        if not path.is_file():
            raise ReportError(f"Input is not a regular file: {path}")
        size = path.stat().st_size
    except OSError as error:
        raise ReportError(f"Cannot inspect {path}: {error}") from error
    if size > MAX_FILE_BYTES:
        raise ReportError(f"Input exceeds the {MAX_FILE_BYTES}-byte limit: {path}")
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise ReportError(f"Cannot read {path}: {error}") from error
    upper = raw[:4096].upper()
    if b"<!DOCTYPE" in upper or b"<!ENTITY" in upper:
        raise ReportError(f"DTD and entity declarations are not allowed: {path}")
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as error:
        raise ReportError(f"Invalid XML in {path}: {error}") from error
    if _local(root.tag) not in {"testsuite", "testsuites"}:
        raise ReportError(f"Root element must be testsuite or testsuites: {path}")

    executions: list[Execution] = []
    for case in root.iter():
        if _local(case.tag) != "testcase":
            continue
        name = (case.get("name") or "").strip()
        if not name:
            raise ReportError(f"A testcase is missing its name in {path}")
        suite = (case.get("classname") or "unclassified").strip() or "unclassified"
        try:
            seconds = float(case.get("time", "0") or "0")
        except ValueError as error:
            raise ReportError(f"Invalid duration for {suite}::{name} in {path}") from error
        if not math.isfinite(seconds) or seconds < 0:
            raise ReportError(f"Duration must be a finite non-negative number for {suite}::{name}")
        executions.append(Execution(
            test_id=f"{suite}::{name}", suite=suite, name=name,
            status=_status(case), seconds=seconds, source=str(path),
        ))
    return tuple(executions)


def _collect_files(inputs: Iterable[str | Path]) -> tuple[Path, ...]:
    files: set[Path] = set()
    for supplied in inputs:
        path = Path(supplied)
        if path.is_symlink():
            raise ReportError(f"Symlink inputs are not allowed: {path}")
        if path.is_dir():
            files.update(item for item in path.rglob("*.xml") if item.is_file() and not item.is_symlink())
        elif path.is_file():
            files.add(path)
        else:
            raise ReportError(f"Input does not exist: {path}")
    ordered = tuple(sorted(files, key=lambda item: str(item)))
    if not ordered:
        raise ReportError("No JUnit XML files were found")
    if len(ordered) > MAX_FILES:
        raise ReportError(f"Input exceeds the {MAX_FILES}-file limit")
    return ordered


def analyze(inputs: Iterable[str | Path], slow_seconds: float = 1.0) -> Report:
    if not math.isfinite(slow_seconds) or slow_seconds < 0:
        raise ReportError("Slow threshold must be a finite non-negative number")
    executions: list[Execution] = []
    for filename in _collect_files(inputs):
        executions.extend(parse_report(filename))
        if len(executions) > MAX_EXECUTIONS:
            raise ReportError(f"Input exceeds the {MAX_EXECUTIONS}-execution limit")
    executions.sort(key=lambda item: (item.test_id, item.source, item.status))
    return Report(tuple(executions), slow_seconds)

