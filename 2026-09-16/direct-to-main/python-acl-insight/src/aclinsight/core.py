"""Validate firewall ACL exports and find risky or unreachable rules."""

from __future__ import annotations

import csv
from dataclasses import asdict, dataclass
import ipaddress
from pathlib import Path
from typing import Iterable


class ACLInputError(ValueError):
    """Raised for unsafe files or invalid CLI limits."""


@dataclass(frozen=True)
class Rule:
    row: int
    rule_id: str
    action: str
    protocol: str
    source: ipaddress.IPv4Network | ipaddress.IPv6Network | None
    destination: ipaddress.IPv4Network | ipaddress.IPv6Network | None
    source_port: tuple[int, int] | None
    destination_port: tuple[int, int] | None
    enabled: bool


@dataclass(frozen=True)
class Finding:
    row: int
    rule_id: str
    severity: str
    code: str
    message: str


REQUIRED = {
    "rule_id", "action", "protocol", "source", "destination",
    "source_port", "destination_port", "enabled",
}
TRUTHY = {"true", "yes", "1", "enabled"}
FALSY = {"false", "no", "0", "disabled"}


def parse_network(value: str):
    normalized = value.strip().lower()
    if normalized == "any":
        return None
    try:
        return ipaddress.ip_network(normalized, strict=False)
    except ValueError as exc:
        raise ValueError("must be any or a valid IPv4/IPv6 CIDR") from exc


def parse_port(value: str) -> tuple[int, int] | None:
    normalized = value.strip().lower()
    if normalized == "any":
        return None
    try:
        if "-" in normalized:
            start_text, end_text = normalized.split("-", 1)
            start, end = int(start_text), int(end_text)
        else:
            start = end = int(normalized)
    except ValueError as exc:
        raise ValueError("must be any, an integer, or a start-end range") from exc
    if not (1 <= start <= end <= 65535):
        raise ValueError("must be within 1-65535 and ordered")
    return start, end


def _boolean(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in TRUTHY:
        return True
    if normalized in FALSY:
        return False
    raise ValueError("must be true/false, yes/no, 1/0, or enabled/disabled")


def _rule(row_number: int, row: dict[str, str]) -> Rule:
    rule_id = (row.get("rule_id") or "").strip()
    if not rule_id or len(rule_id) > 60:
        raise ValueError("rule_id is required and must be at most 60 characters")
    action = (row.get("action") or "").strip().lower()
    if action not in {"allow", "deny"}:
        raise ValueError("action must be allow or deny")
    protocol = (row.get("protocol") or "").strip().lower()
    if protocol not in {"tcp", "udp", "icmp", "any"}:
        raise ValueError("protocol must be tcp, udp, icmp, or any")
    source = parse_network(row.get("source") or "")
    destination = parse_network(row.get("destination") or "")
    source_port = parse_port(row.get("source_port") or "")
    destination_port = parse_port(row.get("destination_port") or "")
    if protocol in {"icmp", "any"} and (source_port is not None or destination_port is not None):
        raise ValueError("ports must be any when protocol is icmp or any")
    return Rule(
        row=row_number,
        rule_id=rule_id,
        action=action,
        protocol=protocol,
        source=source,
        destination=destination,
        source_port=source_port,
        destination_port=destination_port,
        enabled=_boolean(row.get("enabled") or ""),
    )


def _network_covers(earlier, later) -> bool:
    if earlier is None:
        return True
    if later is None or earlier.version != later.version:
        return False
    return later.subnet_of(earlier)


def _port_covers(earlier, later) -> bool:
    if earlier is None:
        return True
    if later is None:
        return False
    return earlier[0] <= later[0] and earlier[1] >= later[1]


def _covers(earlier: Rule, later: Rule) -> bool:
    return (
        (earlier.protocol == "any" or earlier.protocol == later.protocol)
        and _network_covers(earlier.source, later.source)
        and _network_covers(earlier.destination, later.destination)
        and _port_covers(earlier.source_port, later.source_port)
        and _port_covers(earlier.destination_port, later.destination_port)
    )


def _contains_port(port_range, port: int) -> bool:
    return port_range is None or port_range[0] <= port <= port_range[1]


def analyze(rules: Iterable[Rule]) -> list[Finding]:
    ordered = list(rules)
    findings: list[Finding] = []
    seen_ids: dict[str, int] = {}
    enabled_before: list[Rule] = []
    for rule in ordered:
        key = rule.rule_id.casefold()
        if key in seen_ids:
            findings.append(Finding(rule.row, rule.rule_id, "error", "DUPLICATE_ID", "Rule ID already appeared on row " + str(seen_ids[key])))
        else:
            seen_ids[key] = rule.row
        if not rule.enabled:
            findings.append(Finding(rule.row, rule.rule_id, "info", "DISABLED", "Rule is disabled and does not affect evaluation"))
            continue
        if rule.action == "allow" and rule.source is None and rule.destination is None:
            findings.append(Finding(rule.row, rule.rule_id, "warning", "BROAD_ALLOW", "Allow rule uses any source and any destination"))
        if (
            rule.action == "allow"
            and rule.source is None
            and rule.protocol in {"tcp", "any"}
            and any(_contains_port(rule.destination_port, port) for port in (22, 3389))
        ):
            findings.append(Finding(rule.row, rule.rule_id, "warning", "EXPOSED_ADMIN", "Public source can reach SSH or RDP ports"))
        for earlier in enabled_before:
            if _covers(earlier, rule):
                if earlier.action == rule.action:
                    findings.append(Finding(rule.row, rule.rule_id, "warning", "REDUNDANT", "Earlier rule " + earlier.rule_id + " already covers this traffic"))
                else:
                    findings.append(Finding(rule.row, rule.rule_id, "error", "SHADOWED", "Earlier rule " + earlier.rule_id + " makes this rule unreachable"))
                break
        enabled_before.append(rule)
    order = {"error": 0, "warning": 1, "info": 2}
    return sorted(findings, key=lambda item: (item.row, order[item.severity], item.code))


def audit_csv(path: str | Path, *, max_rows: int = 5000, max_bytes: int = 2_000_000) -> dict:
    if max_rows < 1 or max_rows > 100_000:
        raise ACLInputError("max_rows must be between 1 and 100000")
    candidate = Path(path)
    if candidate.is_symlink() or not candidate.is_file():
        raise ACLInputError("input must be a regular, non-symlink CSV file")
    if candidate.stat().st_size > max_bytes:
        raise ACLInputError("input exceeds the configured byte limit")
    try:
        handle = candidate.open("r", encoding="utf-8-sig", newline="")
    except OSError as exc:
        raise ACLInputError("could not open input: " + str(exc)) from exc
    with handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ACLInputError("CSV header is missing")
        missing = REQUIRED - {name.strip() for name in reader.fieldnames}
        if missing:
            raise ACLInputError("missing columns: " + ", ".join(sorted(missing)))
        rules: list[Rule] = []
        row_errors: list[dict] = []
        for index, row in enumerate(reader, start=2):
            if index - 1 > max_rows:
                raise ACLInputError("row count exceeds the configured limit")
            try:
                rules.append(_rule(index, row))
            except ValueError as exc:
                row_errors.append({"row": index, "error": str(exc)})
    if not rules and not row_errors:
        raise ACLInputError("CSV has no data rows")
    findings = analyze(rules)
    severity = {key: 0 for key in ("error", "warning", "info")}
    for item in findings:
        severity[item.severity] += 1
    return {
        "summary": {
            "rows": len(rules) + len(row_errors),
            "valid_rules": len(rules),
            "invalid_rows": len(row_errors),
            **severity,
        },
        "findings": [asdict(item) for item in findings],
        "row_errors": row_errors,
    }
