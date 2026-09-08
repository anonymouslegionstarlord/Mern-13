"""Pure URL analysis with no network activity."""

from __future__ import annotations

from collections import Counter
from dataclasses import asdict, dataclass
from typing import Iterable, Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

Severity = Literal["warning", "error"]
TRACKING_KEYS = {"fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid"}


@dataclass(frozen=True, slots=True)
class Finding:
    severity: Severity
    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class URLResult:
    line: int
    original: str
    sanitized: str | None
    findings: tuple[Finding, ...]

    @property
    def errors(self) -> int:
        return sum(item.severity == "error" for item in self.findings)

    @property
    def warnings(self) -> int:
        return sum(item.severity == "warning" for item in self.findings)

    def to_dict(self) -> dict[str, object]:
        return {
            "line": self.line,
            "original": self.original,
            "sanitized": self.sanitized,
            "findings": [item.to_dict() for item in self.findings],
        }


@dataclass(frozen=True, slots=True)
class AuditReport:
    results: tuple[URLResult, ...]

    @property
    def errors(self) -> int:
        return sum(item.errors for item in self.results)

    @property
    def warnings(self) -> int:
        return sum(item.warnings for item in self.results)

    def to_dict(self) -> dict[str, object]:
        return {
            "summary": {"urls": len(self.results), "warnings": self.warnings, "errors": self.errors},
            "results": [item.to_dict() for item in self.results],
        }


def _is_tracking(key: str) -> bool:
    lowered = key.casefold()
    return lowered.startswith("utm_") or lowered in TRACKING_KEYS


def _error_result(raw: str, line: int, code: str, message: str) -> URLResult:
    return URLResult(line, raw, None, (Finding("error", code, message),))


def analyze_url(raw: str, *, line: int = 1, max_length: int = 4096) -> URLResult:
    """Audit one HTTP(S) URL and return a non-destructive clean candidate."""

    value = raw.strip()
    if not value:
        return _error_result(raw, line, "empty-url", "URL is empty")
    if len(value) > max_length:
        return _error_result(value, line, "url-too-long", f"URL exceeds {max_length} characters")

    try:
        parsed = urlsplit(value)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError as error:
        return _error_result(value, line, "invalid-url", str(error))

    scheme = parsed.scheme.casefold()
    findings: list[Finding] = []
    if scheme not in {"http", "https"}:
        return _error_result(value, line, "unsupported-scheme", "Only http and https URLs are supported")
    if not hostname:
        return _error_result(value, line, "missing-host", "URL must include a hostname")
    if scheme == "http":
        findings.append(Finding("warning", "cleartext-http", "HTTPS is preferred when the destination supports it"))
    if parsed.username is not None or parsed.password is not None:
        findings.append(Finding("warning", "embedded-credentials", "User information was removed from the clean URL"))
    if parsed.fragment:
        findings.append(Finding("warning", "fragment", "Fragment was removed from the clean URL"))

    try:
        pairs = parse_qsl(parsed.query, keep_blank_values=True, max_num_fields=200)
    except ValueError as error:
        return _error_result(value, line, "invalid-query", str(error))

    counts = Counter(key.casefold() for key, _ in pairs)
    for key, count in sorted(counts.items()):
        if key and count > 1:
            findings.append(Finding("warning", "duplicate-parameter", f"Query key '{key}' appears {count} times"))
    if any(not key for key, _ in pairs):
        findings.append(Finding("warning", "empty-parameter", "Query contains an empty parameter name"))

    clean_pairs = []
    tracking_seen = set()
    for key, value_part in pairs:
        if _is_tracking(key):
            tracking_seen.add(key.casefold())
        else:
            clean_pairs.append((key, value_part))
    if tracking_seen:
        findings.append(Finding("warning", "tracking-parameters", f"Removed: {', '.join(sorted(tracking_seen))}"))

    try:
        ascii_host = hostname.encode("idna").decode("ascii").casefold()
    except UnicodeError as error:
        return _error_result(value, line, "invalid-host", str(error))
    host_for_url = f"[{ascii_host}]" if ":" in ascii_host else ascii_host
    default_port = (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
    netloc = host_for_url if port is None or default_port else f"{host_for_url}:{port}"
    path = parsed.path or "/"
    sanitized = urlunsplit((scheme, netloc, path, urlencode(clean_pairs, doseq=True), ""))

    findings.sort(key=lambda item: (0 if item.severity == "error" else 1, item.code))
    return URLResult(line, value, sanitized, tuple(findings))


def audit_urls(lines: Iterable[str], *, max_urls: int = 1000) -> AuditReport:
    """Audit non-empty, non-comment input lines with a bounded batch size."""

    if not 1 <= max_urls <= 100_000:
        raise ValueError("max_urls must be between 1 and 100,000")
    selected = [(number, value.strip()) for number, value in enumerate(lines, 1) if value.strip() and not value.lstrip().startswith("#")]
    if not selected:
        raise ValueError("no URLs were provided")
    if len(selected) > max_urls:
        raise ValueError(f"input has {len(selected)} URLs; limit is {max_urls}")
    return AuditReport(tuple(analyze_url(value, line=number) for number, value in selected))

