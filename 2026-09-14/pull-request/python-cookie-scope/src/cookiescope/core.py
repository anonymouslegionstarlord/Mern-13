"""Parse Set-Cookie headers and report defensive configuration findings."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from email.utils import parsedate_to_datetime
import re
from typing import Iterable


class CookieError(ValueError):
    """Raised when a header cannot be safely parsed."""


@dataclass(frozen=True)
class Finding:
    severity: str
    code: str
    message: str


@dataclass(frozen=True)
class CookieAudit:
    name: str
    attributes: tuple[str, ...]
    findings: tuple[Finding, ...]

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "attributes": list(self.attributes),
            "findings": [asdict(item) for item in self.findings],
        }


TOKEN = re.compile(r"^[A-Za-z0-9!#$%&'*+.^_|~-]+$")
CONTROL = re.compile(r"[\x00-\x1f\x7f]")
SEVERITIES = ("info", "warning", "error")


def _finding(severity: str, code: str, message: str) -> Finding:
    return Finding(severity, code, message)


def inspect_header(header: str, *, max_length: int = 8192) -> CookieAudit:
    if not isinstance(header, str):
        raise CookieError("header must be text")
    header = header.strip()
    if header.lower().startswith("set-cookie:"):
        header = header.split(":", 1)[1].strip()
    if not header:
        raise CookieError("header is empty")
    if len(header) > max_length:
        raise CookieError("header exceeds the configured length limit")
    if CONTROL.search(header):
        raise CookieError("header contains a control character")

    parts = [part.strip() for part in header.split(";")]
    if "=" not in parts[0]:
        raise CookieError("cookie name/value pair is missing")
    name, _value = parts[0].split("=", 1)
    name = name.strip()
    if not name or not TOKEN.fullmatch(name):
        raise CookieError("cookie name is invalid")

    attributes: dict[str, str | None] = {}
    duplicates: list[str] = []
    for raw in parts[1:]:
        if not raw:
            continue
        attr_name, separator, attr_value = raw.partition("=")
        key = attr_name.strip().lower()
        if not key or not TOKEN.fullmatch(key):
            raise CookieError("attribute name is invalid")
        if key in attributes:
            duplicates.append(key)
        attributes[key] = attr_value.strip() if separator else None

    findings: list[Finding] = []
    for duplicate in sorted(set(duplicates)):
        findings.append(_finding("warning", "DUPLICATE_ATTRIBUTE", "Attribute " + duplicate + " is repeated"))

    secure = "secure" in attributes
    http_only = "httponly" in attributes
    same_site = attributes.get("samesite")

    if not secure:
        findings.append(_finding("warning", "SECURE_MISSING", "Add Secure for HTTPS-only transport"))
    if not http_only:
        findings.append(_finding("warning", "HTTPONLY_MISSING", "Add HttpOnly when JavaScript access is unnecessary"))
    if same_site is None:
        findings.append(_finding("warning", "SAMESITE_MISSING", "Set SameSite to Lax, Strict, or None"))
    elif same_site.lower() not in {"lax", "strict", "none"}:
        findings.append(_finding("error", "SAMESITE_INVALID", "SameSite must be Lax, Strict, or None"))
    elif same_site.lower() == "none" and not secure:
        findings.append(_finding("error", "NONE_WITHOUT_SECURE", "SameSite=None requires Secure"))

    domain = attributes.get("domain")
    if "domain" in attributes:
        if not domain:
            findings.append(_finding("error", "DOMAIN_EMPTY", "Domain must not be empty"))
        else:
            findings.append(_finding("info", "DOMAIN_SCOPE", "Domain broadens the cookie beyond a host-only scope"))

    path = attributes.get("path")
    if "path" in attributes and not path:
        findings.append(_finding("error", "PATH_EMPTY", "Path must not be empty"))

    max_age = attributes.get("max-age")
    if "max-age" in attributes:
        try:
            int(max_age or "")
        except ValueError:
            findings.append(_finding("error", "MAX_AGE_INVALID", "Max-Age must be an integer"))

    expires = attributes.get("expires")
    if "expires" in attributes:
        try:
            if not expires or parsedate_to_datetime(expires) is None:
                raise ValueError
        except (TypeError, ValueError, OverflowError):
            findings.append(_finding("error", "EXPIRES_INVALID", "Expires must be a valid HTTP date"))

    if name.startswith("__Secure-") and not secure:
        findings.append(_finding("error", "SECURE_PREFIX", "__Secure- cookies require Secure"))
    if name.startswith("__Host-"):
        if not secure:
            findings.append(_finding("error", "HOST_SECURE", "__Host- cookies require Secure"))
        if path != "/":
            findings.append(_finding("error", "HOST_PATH", "__Host- cookies require Path=/"))
        if "domain" in attributes:
            findings.append(_finding("error", "HOST_DOMAIN", "__Host- cookies must not set Domain"))

    findings.sort(key=lambda item: (SEVERITIES.index(item.severity), item.code))
    return CookieAudit(name=name, attributes=tuple(sorted(attributes)), findings=tuple(findings))


def audit_headers(
    headers: Iterable[str],
    *,
    max_headers: int = 1000,
    max_length: int = 8192,
) -> dict:
    if max_headers < 1 or max_headers > 10_000:
        raise CookieError("max_headers must be between 1 and 10000")
    values = list(headers)
    if not values:
        raise CookieError("no Set-Cookie headers were supplied")
    if len(values) > max_headers:
        raise CookieError("header count exceeds the configured limit")

    cookies: list[dict] = []
    errors: list[dict] = []
    severity_counts = {severity: 0 for severity in SEVERITIES}
    for index, header in enumerate(values, start=1):
        try:
            result = inspect_header(header, max_length=max_length)
            cookies.append(result.to_dict())
            for item in result.findings:
                severity_counts[item.severity] += 1
        except CookieError as exc:
            errors.append({"index": index, "error": str(exc)})

    return {
        "summary": {
            "headers": len(values),
            "inspected": len(cookies),
            "parse_errors": len(errors),
            **severity_counts,
        },
        "cookies": cookies,
        "errors": errors,
    }

