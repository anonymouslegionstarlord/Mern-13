import unittest

from loglens.parser import parse_line, parse_lines
from loglens.report import build_report


class ParserTests(unittest.TestCase):
    def test_parse_valid_line(self):
        record = parse_line("2026-08-16T09:15:00Z INFO api Server started")
        self.assertEqual(record.level, "INFO")
        self.assertEqual(record.service, "api")
        self.assertEqual(record.message, "Server started")

    def test_invalid_level_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "unsupported level"):
            parse_line("2026-08-16T09:15:00Z NOTICE api Hello")

    def test_malformed_lines_are_counted(self):
        records, malformed = parse_lines(["bad line", "2026-08-16T09:15:00Z ERROR worker Job failed"])
        self.assertEqual(len(records), 1)
        self.assertEqual(malformed, 1)


class ReportTests(unittest.TestCase):
    def test_report_filters_below_minimum_level(self):
        records, _ = parse_lines([
            "2026-08-16T09:00:00Z INFO api Ready",
            "2026-08-16T09:01:00Z WARNING api Slow request",
            "2026-08-16T09:02:00Z ERROR worker Job failed",
            "2026-08-16T09:03:00Z ERROR worker Job failed",
        ])
        report = build_report(records, min_level="WARNING", top=1)
        self.assertEqual(report["total"], 3)
        self.assertEqual(report["levels"], {"WARNING": 1, "ERROR": 2})
        self.assertEqual(report["top_messages"], [{"message": "Job failed", "count": 2}])

    def test_top_must_be_positive(self):
        with self.assertRaisesRegex(ValueError, "at least 1"):
            build_report([], top=0)


if __name__ == "__main__":
    unittest.main()

