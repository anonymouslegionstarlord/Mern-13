"""Ticket parsing and SLA calculations."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

DEFAULT_SLA_HOURS = {"P1": 4.0, "P2": 8.0, "P3": 24.0, "P4": 72.0}
REQUIRED_COLUMNS = {"ticket_id", "opened_at", "priority", "status", "resolved_at"}


class SLAError(ValueError):
    """Raised for invalid input or SLA configuration."""


@dataclass(frozen=True, slots=True)
class Ticket:
    ticket_id: str
    opened_at: datetime
    priority: str
    status: str
    resolved_at: datetime | None = None


def parse_timestamp(value: str, field: str) -> datetime:
    raw = str(value or "").strip()
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise SLAError(f"{field} must be an ISO 8601 timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise SLAError(f"{field} must include a UTC offset or Z")
    return parsed.astimezone(timezone.utc)


def ticket_from_row(row: dict[str, str], row_number: int) -> Ticket:
    ticket_id = str(row.get("ticket_id", "")).strip()
    if not ticket_id or len(ticket_id) > 64:
        raise SLAError(f"Row {row_number}: ticket_id is required and must be at most 64 characters")
    priority = str(row.get("priority", "")).strip().upper()
    if priority not in DEFAULT_SLA_HOURS:
        raise SLAError(f"Row {row_number}: priority must be P1, P2, P3, or P4")
    status = str(row.get("status", "")).strip().lower()
    if status not in {"open", "resolved"}:
        raise SLAError(f"Row {row_number}: status must be open or resolved")
    opened_at = parse_timestamp(row.get("opened_at", ""), f"Row {row_number} opened_at")
    resolved_raw = str(row.get("resolved_at", "")).strip()
    resolved_at = parse_timestamp(resolved_raw, f"Row {row_number} resolved_at") if resolved_raw else None
    if status == "resolved" and resolved_at is None:
        raise SLAError(f"Row {row_number}: resolved tickets require resolved_at")
    if status == "open" and resolved_at is not None:
        raise SLAError(f"Row {row_number}: open tickets must not include resolved_at")
    if resolved_at and resolved_at < opened_at:
        raise SLAError(f"Row {row_number}: resolved_at cannot be before opened_at")
    return Ticket(ticket_id, opened_at, priority, status, resolved_at)


def read_tickets(path: str | Path) -> list[Ticket]:
    source = Path(path)
    try:
        with source.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            columns = set(reader.fieldnames or [])
            missing = sorted(REQUIRED_COLUMNS - columns)
            if missing:
                raise SLAError(f"Missing CSV columns: {', '.join(missing)}")
            tickets = [ticket_from_row(row, number) for number, row in enumerate(reader, start=2)]
    except OSError as exc:
        raise SLAError(f"Could not read {source}: {exc}") from exc
    identifiers = [ticket.ticket_id for ticket in tickets]
    if len(set(identifiers)) != len(identifiers):
        raise SLAError("ticket_id values must be unique")
    return tickets


def validate_targets(targets: dict[str, float] | None) -> dict[str, float]:
    result = dict(DEFAULT_SLA_HOURS)
    for priority, raw_hours in (targets or {}).items():
        key = str(priority).upper()
        if key not in result:
            raise SLAError(f"Unknown priority in SLA target: {priority}")
        try:
            hours = float(raw_hours)
        except (TypeError, ValueError) as exc:
            raise SLAError(f"SLA hours for {key} must be numeric") from exc
        if not 0 < hours <= 8760:
            raise SLAError(f"SLA hours for {key} must be greater than 0 and at most 8760")
        result[key] = hours
    return result


def evaluate(ticket: Ticket, *, as_of: datetime | None = None, targets: dict[str, float] | None = None) -> dict[str, object]:
    current = as_of or datetime.now(timezone.utc)
    if current.tzinfo is None or current.utcoffset() is None:
        raise SLAError("as_of must be timezone-aware")
    current = current.astimezone(timezone.utc)
    end = ticket.resolved_at or current
    if end < ticket.opened_at:
        raise SLAError(f"as_of is before ticket {ticket.ticket_id} opened")
    sla_hours = validate_targets(targets)[ticket.priority]
    elapsed = (end - ticket.opened_at).total_seconds() / 3600
    remaining = sla_hours - elapsed
    breached = elapsed > sla_hours
    at_risk = ticket.status == "open" and not breached and remaining <= sla_hours * 0.25
    return {
        "ticket_id": ticket.ticket_id,
        "priority": ticket.priority,
        "status": ticket.status,
        "elapsed_hours": round(elapsed, 2),
        "sla_hours": sla_hours,
        "remaining_hours": round(remaining, 2),
        "breached": breached,
        "at_risk": at_risk,
    }


def summarize(tickets: Iterable[Ticket], *, as_of: datetime | None = None, targets: dict[str, float] | None = None) -> dict[str, object]:
    results = [evaluate(ticket, as_of=as_of, targets=targets) for ticket in tickets]
    resolved = [item for item in results if item["status"] == "resolved"]
    compliant = sum(not item["breached"] for item in resolved)
    by_priority = {
        priority: {
            "total": sum(item["priority"] == priority for item in results),
            "breached": sum(item["priority"] == priority and item["breached"] for item in results),
            "at_risk": sum(item["priority"] == priority and item["at_risk"] for item in results),
        }
        for priority in DEFAULT_SLA_HOURS
    }
    return {
        "total": len(results),
        "open": sum(item["status"] == "open" for item in results),
        "resolved": len(resolved),
        "breached": sum(item["breached"] for item in results),
        "at_risk": sum(item["at_risk"] for item in results),
        "resolved_compliance_percent": round(compliant / len(resolved) * 100, 2) if resolved else None,
        "by_priority": by_priority,
        "tickets": results,
    }

