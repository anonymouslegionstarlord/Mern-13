"""Command-line interface for SLAWatch."""

from __future__ import annotations

import argparse
import json
import sys

from .core import SLAError, parse_timestamp, read_tickets, summarize


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="slawatch", description="Audit a support-ticket CSV against SLA targets")
    root.add_argument("csv_file")
    root.add_argument("--as-of", help="Timezone-aware ISO 8601 calculation time (default: now)")
    root.add_argument("--sla", action="append", default=[], metavar="PRIORITY=HOURS", help="Override a target, e.g. P1=2")
    root.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    return root


def parse_targets(values: list[str]) -> dict[str, float]:
    targets = {}
    for value in values:
        if "=" not in value:
            raise SLAError(f"SLA override must use PRIORITY=HOURS: {value}")
        priority, hours = value.split("=", 1)
        try:
            targets[priority.strip().upper()] = float(hours)
        except ValueError as exc:
            raise SLAError(f"SLA hours must be numeric: {value}") from exc
    return targets


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        as_of = parse_timestamp(args.as_of, "as_of") if args.as_of else None
        report = summarize(read_tickets(args.csv_file), as_of=as_of, targets=parse_targets(args.sla))
        if args.json:
            print(json.dumps(report, indent=2))
        else:
            compliance = "n/a" if report["resolved_compliance_percent"] is None else f"{report['resolved_compliance_percent']:.2f}%"
            print(f"Tickets: {report['total']} | Open: {report['open']} | Resolved: {report['resolved']}")
            print(f"Breached: {report['breached']} | At risk: {report['at_risk']} | Resolved compliance: {compliance}")
            for item in report["tickets"]:
                state = "BREACHED" if item["breached"] else "AT RISK" if item["at_risk"] else "OK"
                print(f"{state:8} {item['ticket_id']:16} {item['priority']} elapsed={item['elapsed_hours']:.2f}h remaining={item['remaining_hours']:.2f}h")
        return 1 if report["breached"] else 0
    except SLAError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

