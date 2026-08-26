import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from slawatch.core import SLAError, Ticket, evaluate, parse_timestamp, read_tickets, summarize


UTC = timezone.utc


class SLAWatchTests(unittest.TestCase):
    def test_parse_timestamp_normalizes_offset(self):
        parsed = parse_timestamp("2026-08-26T10:30:00+05:30", "opened_at")
        self.assertEqual(parsed, datetime(2026, 8, 26, 5, 0, tzinfo=UTC))

    def test_naive_timestamp_is_rejected(self):
        with self.assertRaisesRegex(SLAError, "offset"):
            parse_timestamp("2026-08-26T10:30:00", "opened_at")

    def test_read_tickets_validates_and_detects_duplicates(self):
        csv_text = "ticket_id,opened_at,priority,status,resolved_at\nINC-1,2026-08-26T00:00:00Z,P1,open,\nINC-1,2026-08-26T01:00:00Z,P2,open,\n"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "tickets.csv"
            path.write_text(csv_text, encoding="utf-8")
            with self.assertRaisesRegex(SLAError, "unique"):
                read_tickets(path)

    def test_resolved_ticket_within_target(self):
        ticket = Ticket("INC-1", datetime(2026, 8, 26, tzinfo=UTC), "P1", "resolved", datetime(2026, 8, 26, 3, tzinfo=UTC))
        result = evaluate(ticket)
        self.assertFalse(result["breached"])
        self.assertEqual(result["remaining_hours"], 1.0)

    def test_open_ticket_can_be_at_risk_or_breached(self):
        opened = datetime(2026, 8, 26, tzinfo=UTC)
        at_risk = evaluate(Ticket("A", opened, "P1", "open"), as_of=datetime(2026, 8, 26, 3, 30, tzinfo=UTC))
        breached = evaluate(Ticket("B", opened, "P1", "open"), as_of=datetime(2026, 8, 26, 5, tzinfo=UTC))
        self.assertTrue(at_risk["at_risk"])
        self.assertTrue(breached["breached"])

    def test_custom_target_is_applied(self):
        ticket = Ticket("INC-2", datetime(2026, 8, 26, tzinfo=UTC), "P2", "open")
        result = evaluate(ticket, as_of=datetime(2026, 8, 26, 3, tzinfo=UTC), targets={"P2": 2})
        self.assertTrue(result["breached"])
        with self.assertRaises(SLAError):
            evaluate(ticket, targets={"P5": 3})

    def test_summary_reports_resolved_compliance(self):
        opened = datetime(2026, 8, 26, tzinfo=UTC)
        tickets = [
            Ticket("FAST", opened, "P1", "resolved", datetime(2026, 8, 26, 2, tzinfo=UTC)),
            Ticket("SLOW", opened, "P1", "resolved", datetime(2026, 8, 26, 6, tzinfo=UTC)),
            Ticket("OPEN", opened, "P2", "open"),
        ]
        report = summarize(tickets, as_of=datetime(2026, 8, 26, 4, tzinfo=UTC))
        self.assertEqual(report["breached"], 1)
        self.assertEqual(report["resolved_compliance_percent"], 50.0)
        self.assertEqual(report["by_priority"]["P1"]["total"], 2)


if __name__ == "__main__":
    unittest.main()
