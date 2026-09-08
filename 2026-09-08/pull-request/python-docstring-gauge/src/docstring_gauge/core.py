"""Scan Python syntax trees without importing target modules."""

from __future__ import annotations

import ast
from dataclasses import asdict, dataclass
from fnmatch import fnmatch
from pathlib import Path
from typing import Iterable

DEFAULT_IGNORES = ("*/.venv/*", "*/venv/*", "*/__pycache__/*", "*/node_modules/*")


@dataclass(frozen=True, slots=True)
class Definition:
    file: str
    line: int
    kind: str
    name: str
    documented: bool
    docstring_characters: int

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class Finding:
    file: str
    line: int
    code: str
    message: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class ScanReport:
    files: int
    definitions: tuple[Definition, ...]
    findings: tuple[Finding, ...]

    @property
    def documented(self) -> int:
        return sum(item.documented for item in self.definitions)

    @property
    def coverage(self) -> float:
        return round(100.0 * self.documented / len(self.definitions), 1) if self.definitions else 100.0

    def to_dict(self) -> dict[str, object]:
        return {
            "summary": {
                "files": self.files,
                "definitions": len(self.definitions),
                "documented": self.documented,
                "missing": len(self.definitions) - self.documented,
                "coverage_percent": self.coverage,
                "findings": len(self.findings),
            },
            "definitions": [item.to_dict() for item in self.definitions],
            "findings": [item.to_dict() for item in self.findings],
        }


class _Collector(ast.NodeVisitor):
    def __init__(self, filename: str, include_private: bool, include_modules: bool):
        self.filename = filename
        self.include_private = include_private
        self.include_modules = include_modules
        self.parents: list[str] = []
        self.definitions: list[Definition] = []

    def _public(self, name: str) -> bool:
        return self.include_private or not name.startswith("_")

    def _record(self, node: ast.AST, kind: str, name: str) -> None:
        doc = ast.get_docstring(node, clean=False) or ""
        self.definitions.append(Definition(
            self.filename, getattr(node, "lineno", 1), kind,
            ".".join([*self.parents, name]), bool(doc.strip()), len(doc.strip()),
        ))

    def visit_Module(self, node: ast.Module) -> None:
        if self.include_modules:
            self._record(node, "module", Path(self.filename).stem)
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        if self._public(node.name):
            self._record(node, "class", node.name)
        self.parents.append(node.name)
        self.generic_visit(node)
        self.parents.pop()

    def _visit_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        if self._public(node.name):
            kind = "method" if self.parents else ("async-function" if isinstance(node, ast.AsyncFunctionDef) else "function")
            self._record(node, kind, node.name)
        self.parents.append(node.name)
        self.generic_visit(node)
        self.parents.pop()

    visit_FunctionDef = _visit_function
    visit_AsyncFunctionDef = _visit_function


def _selected_files(paths: Iterable[str | Path], excludes: tuple[str, ...]) -> list[Path]:
    files: set[Path] = set()
    for raw in paths:
        path = Path(raw)
        if path.is_file() and path.suffix == ".py":
            files.add(path)
        elif path.is_dir():
            files.update(item for item in path.rglob("*.py") if item.is_file())
        else:
            raise ValueError(f"path is not a Python file or directory: {path}")
    patterns = (*DEFAULT_IGNORES, *excludes)
    return sorted(path for path in files if not any(fnmatch(path.as_posix(), pattern) for pattern in patterns))


def scan_paths(
    paths: Iterable[str | Path],
    *,
    excludes: tuple[str, ...] = (),
    include_private: bool = False,
    include_modules: bool = True,
    max_files: int = 5000,
) -> ScanReport:
    """Parse selected Python files and calculate docstring coverage."""

    if not 1 <= max_files <= 100_000:
        raise ValueError("max_files must be between 1 and 100,000")
    files = _selected_files(paths, excludes)
    if not files:
        raise ValueError("no Python files matched")
    if len(files) > max_files:
        raise ValueError(f"matched {len(files)} files; limit is {max_files}")

    definitions: list[Definition] = []
    findings: list[Finding] = []
    for path in files:
        label = path.as_posix()
        try:
            source = path.read_text(encoding="utf-8")
            tree = ast.parse(source, filename=label)
        except UnicodeError as error:
            findings.append(Finding(label, 1, "encoding-error", str(error)))
            continue
        except OSError as error:
            findings.append(Finding(label, 1, "read-error", str(error)))
            continue
        except SyntaxError as error:
            findings.append(Finding(label, error.lineno or 1, "syntax-error", error.msg))
            continue
        collector = _Collector(label, include_private, include_modules)
        collector.visit(tree)
        definitions.extend(collector.definitions)

    definitions.sort(key=lambda item: (item.file, item.line, item.name))
    findings.sort(key=lambda item: (item.file, item.line, item.code))
    return ScanReport(len(files), tuple(definitions), tuple(findings))

