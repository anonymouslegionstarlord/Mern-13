"""Small static accessibility checks built on html.parser."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

MAX_FILE_BYTES = 2 * 1024 * 1024


class ScanError(ValueError):
    """Raised for unreadable or invalid scan inputs."""


@dataclass(frozen=True, slots=True)
class Issue:
    source: str
    rule: str
    severity: str
    line: int
    message: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


class AccessibilityParser(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.issues: list[Issue] = []
        self.ids: dict[str, int] = {}
        self.label_for: set[str] = set()
        self.controls: list[tuple[str, int, str | None, bool]] = []
        self.frames: list[dict[str, object]] = []
        self.html_seen = False
        self.title_seen = False
        self.in_title = False
        self.title_text: list[str] = []
        self.viewport_seen = False
        self.label_depth = 0
        self.previous_heading: int | None = None

    def issue(self, rule: str, severity: str, line: int, message: str) -> None:
        self.issues.append(Issue(self.source, rule, severity, line, message))

    @staticmethod
    def attrs_dict(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {name.lower(): (value or "") for name, value in attrs}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        values = self.attrs_dict(attrs)
        line = self.getpos()[0]
        identifier = values.get("id", "").strip()
        if identifier:
            if identifier in self.ids:
                self.issue("duplicate-id", "error", line, f"ID '{identifier}' already appeared on line {self.ids[identifier]}")
            else:
                self.ids[identifier] = line

        if tag == "html":
            self.html_seen = True
            if not values.get("lang", "").strip():
                self.issue("html-lang", "error", line, "The html element needs a non-empty lang attribute")
        elif tag == "title":
            self.title_seen = True
            self.in_title = True
        elif tag == "meta" and values.get("name", "").casefold() == "viewport" and values.get("content", "").strip():
            self.viewport_seen = True
        elif tag == "img":
            if "alt" not in values:
                self.issue("image-alt", "error", line, "Image is missing an alt attribute")
            elif values["alt"].strip():
                for frame in self.frames:
                    frame["has_name"] = True
        elif tag == "label":
            self.label_depth += 1
            if values.get("for", "").strip():
                self.label_for.add(values["for"].strip())

        if tag in {"input", "select", "textarea"}:
            input_type = values.get("type", "text").casefold()
            exempt = tag == "input" and input_type in {"hidden", "submit", "button", "reset"} and bool(values.get("value", "").strip())
            image_named = tag == "input" and input_type == "image" and bool(values.get("alt", "").strip())
            aria_named = bool(values.get("aria-label", "").strip() or values.get("aria-labelledby", "").strip())
            self.controls.append((tag, line, identifier or None, exempt or image_named or aria_named or self.label_depth > 0))

        if tag in {"a", "button"}:
            has_name = bool(values.get("aria-label", "").strip() or values.get("aria-labelledby", "").strip() or values.get("title", "").strip())
            self.frames.append({"tag": tag, "line": line, "has_name": has_name})
            if tag == "a" and values.get("href", "").strip().casefold() in {"", "#", "javascript:void(0)"}:
                self.issue("link-target", "warning", line, "Link has an empty or placeholder destination")

        if len(tag) == 2 and tag.startswith("h") and tag[1].isdigit():
            level = int(tag[1])
            if self.previous_heading is not None and level > self.previous_heading + 1:
                self.issue("heading-order", "warning", line, f"Heading jumps from h{self.previous_heading} to h{level}")
            self.previous_heading = level

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_text.append(data)
        if data.strip():
            for frame in self.frames:
                frame["has_name"] = True

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "title":
            self.in_title = False
        if tag == "label" and self.label_depth:
            self.label_depth -= 1
        if tag in {"a", "button"}:
            index = next((index for index in range(len(self.frames) - 1, -1, -1) if self.frames[index]["tag"] == tag), None)
            if index is not None:
                frame = self.frames.pop(index)
                if not frame["has_name"]:
                    self.issue(f"{tag}-name", "error", int(frame["line"]), f"{tag} element has no accessible name")

    def finish(self) -> list[Issue]:
        if not self.html_seen:
            self.issue("html-lang", "error", 1, "Document is missing an html element with a language")
        if not self.title_seen or not "".join(self.title_text).strip():
            self.issue("document-title", "error", 1, "Document needs a non-empty title")
        if not self.viewport_seen:
            self.issue("viewport", "warning", 1, "Document is missing viewport metadata")
        for tag, line, identifier, has_name in self.controls:
            if not has_name and (not identifier or identifier not in self.label_for):
                self.issue("control-label", "error", line, f"{tag} control has no associated label or ARIA name")
        for frame in self.frames:
            if not frame["has_name"]:
                tag = str(frame["tag"])
                self.issue(f"{tag}-name", "error", int(frame["line"]), f"Unclosed {tag} element has no accessible name")
        return sorted(self.issues, key=lambda issue: (issue.line, issue.severity, issue.rule))


def scan_html(html: str, source: str = "<memory>") -> list[Issue]:
    parser = AccessibilityParser(source)
    parser.feed(html)
    parser.close()
    return parser.finish()


def scan_file(path: str | Path) -> list[Issue]:
    source = Path(path)
    try:
        if source.stat().st_size > MAX_FILE_BYTES:
            raise ScanError(f"{source} exceeds the 2 MB safety limit")
        html = source.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise ScanError(f"{source} is not valid UTF-8") from exc
    except OSError as exc:
        raise ScanError(f"Could not read {source}: {exc}") from exc
    return scan_html(html, str(source))


def discover_paths(inputs: Iterable[str | Path]) -> list[Path]:
    files: set[Path] = set()
    for raw in inputs:
        path = Path(raw)
        if path.is_dir():
            files.update(item for item in path.rglob("*.html") if item.is_file())
            files.update(item for item in path.rglob("*.htm") if item.is_file())
        elif path.is_file():
            files.add(path)
        else:
            raise ScanError(f"Path does not exist: {path}")
    if not files:
        raise ScanError("No HTML files were found")
    return sorted(files, key=lambda item: str(item).casefold())


def scan_paths(inputs: Iterable[str | Path]) -> dict[str, object]:
    files = discover_paths(inputs)
    issues = [issue for path in files for issue in scan_file(path)]
    return {
        "files_scanned": len(files),
        "errors": sum(issue.severity == "error" for issue in issues),
        "warnings": sum(issue.severity == "warning" for issue in issues),
        "issues": [issue.to_dict() for issue in issues],
    }

