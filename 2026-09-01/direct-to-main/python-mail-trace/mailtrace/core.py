"""Parse an RFC-style message and produce conservative header diagnostics."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from email import policy
from email.parser import BytesParser
from email.utils import getaddresses, parsedate_to_datetime
from pathlib import Path
import re

MAX_FILE_BYTES = 2 * 1024 * 1024
SINGLETON_HEADERS = ("from", "date", "message-id", "subject")
AUTH_PATTERN = re.compile(
    r"\b(spf|dkim|dmarc)\s*=\s*(pass|fail|softfail|neutral|none|temperror|permerror)\b",
    re.IGNORECASE,
)
ADDRESS_PATTERN = re.compile(r"^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$")
MESSAGE_ID_PATTERN = re.compile(r"^<[^<>\s@]+@[^<>\s@]+>$")


def _finding(severity: str, code: str, message: str) -> dict[str, str]:
    return {"severity": severity, "code": code, "message": message}


def _addresses(message, header: str) -> list[dict[str, str]]:
    values = message.get_all(header, [])
    return [{"name": name, "address": address} for name, address in getaddresses(values)]


def _domain(address: str) -> str:
    if "@" not in address:
        return ""
    return address.rsplit("@", 1)[1].lower().rstrip(".")


def read_email_file(path: str | Path) -> bytes:
    """Read a bounded message file and return its raw bytes."""
    file_path = Path(path)
    try:
        size = file_path.stat().st_size
    except OSError as exc:
        raise ValueError(f"Could not inspect {file_path}: {exc}") from exc
    if size == 0:
        raise ValueError("Email file is empty")
    if size > MAX_FILE_BYTES:
        raise ValueError(f"Email file exceeds the {MAX_FILE_BYTES}-byte safety limit")
    try:
        return file_path.read_bytes()
    except OSError as exc:
        raise ValueError(f"Could not read {file_path}: {exc}") from exc


def analyze_email(raw: bytes, source: str = "<memory>", now: datetime | None = None) -> dict:
    """Analyze headers only; message bodies and attachments are never returned."""
    if not isinstance(raw, bytes):
        raise TypeError("raw must be bytes")
    if not raw.strip():
        raise ValueError("Email content is empty")
    if len(raw) > MAX_FILE_BYTES:
        raise ValueError(f"Email content exceeds the {MAX_FILE_BYTES}-byte safety limit")

    message = BytesParser(policy=policy.default).parsebytes(raw)
    findings: list[dict[str, str]] = []
    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    for header in ("From", "Date", "Message-ID"):
        if not message.get_all(header, []):
            findings.append(_finding("error", "missing-" + header.lower(), header + " header is missing"))
    if not message.get_all("To", []):
        findings.append(_finding("warning", "missing-to", "To header is missing"))
    if not message.get_all("Subject", []):
        findings.append(_finding("warning", "missing-subject", "Subject header is missing"))

    for header in SINGLETON_HEADERS:
        count = len(message.get_all(header, []))
        if count > 1:
            findings.append(_finding("error", "duplicate-" + header, header.title() + f" appears {count} times"))

    from_addresses = _addresses(message, "From")
    to_addresses = _addresses(message, "To") + _addresses(message, "Cc")
    return_addresses = _addresses(message, "Return-Path")
    for label, records in (("sender", from_addresses), ("recipient", to_addresses), ("return-path", return_addresses)):
        for record in records:
            address = record["address"]
            if not ADDRESS_PATTERN.fullmatch(address):
                findings.append(_finding("warning", "invalid-" + label, label.title() + " address is not a conventional mailbox"))

    from_domains = {_domain(row["address"]) for row in from_addresses if _domain(row["address"])}
    return_domains = {_domain(row["address"]) for row in return_addresses if _domain(row["address"])}
    if from_domains and return_domains and from_domains.isdisjoint(return_domains):
        findings.append(_finding(
            "warning",
            "return-path-domain-mismatch",
            "From and Return-Path use different domains; this can be legitimate but merits context",
        ))

    raw_date = str(message.get("Date", ""))
    normalized_date = None
    if raw_date:
        try:
            parsed_date = parsedate_to_datetime(raw_date)
            if parsed_date is None:
                raise ValueError("unparseable date")
            if parsed_date.tzinfo is None:
                parsed_date = parsed_date.replace(tzinfo=timezone.utc)
            parsed_date = parsed_date.astimezone(timezone.utc)
            normalized_date = parsed_date.isoformat()
            if parsed_date > current_time.astimezone(timezone.utc) + timedelta(hours=24):
                findings.append(_finding("warning", "future-date", "Date header is more than 24 hours in the future"))
        except (TypeError, ValueError, OverflowError):
            findings.append(_finding("error", "invalid-date", "Date header could not be parsed"))

    message_id = str(message.get("Message-ID", "")).strip()
    if message_id and not MESSAGE_ID_PATTERN.fullmatch(message_id):
        findings.append(_finding("warning", "invalid-message-id", "Message-ID does not use the expected <local@domain> form"))

    authentication: dict[str, list[str]] = {"spf": [], "dkim": [], "dmarc": []}
    for header in message.get_all("Authentication-Results", []):
        for mechanism, result in AUTH_PATTERN.findall(str(header)):
            normalized_mechanism = mechanism.lower()
            normalized_result = result.lower()
            if normalized_result not in authentication[normalized_mechanism]:
                authentication[normalized_mechanism].append(normalized_result)

    severity_counts = {"error": 0, "warning": 0}
    for finding in findings:
        severity_counts[finding["severity"]] += 1
    status = "error" if severity_counts["error"] else "warning" if severity_counts["warning"] else "ok"

    return {
        "source": source,
        "status": status,
        "summary": {
            "subject": str(message.get("Subject", "(no subject)")),
            "from": from_addresses,
            "recipient_count": len(to_addresses),
            "date_utc": normalized_date,
            "message_id": message_id or None,
            "received_hops": len(message.get_all("Received", [])),
            "authentication": authentication,
        },
        "counts": severity_counts,
        "findings": findings,
        "notice": "Header signals provide context, not proof that a message is safe or malicious.",
    }
