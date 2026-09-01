from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from mailtrace.core import MAX_FILE_BYTES, analyze_email, read_email_file


VALID = b"""From: Ops Bot <ops@example.com>
To: Team <team@example.net>
Return-Path: <bounce@example.com>
Date: Mon, 31 Aug 2026 09:15:00 +0000
Subject: Nightly status
Message-ID: <nightly-42@example.com>
Received: from relay.example.com by mx.example.net
Authentication-Results: mx.example.net; spf=pass; dkim=pass; dmarc=pass

This body is deliberately not inspected.
"""


class AnalyzeEmailTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc)

    def test_valid_message_has_clean_summary(self):
        report = analyze_email(VALID, now=self.now)
        self.assertEqual(report["status"], "ok")
        self.assertEqual(report["summary"]["received_hops"], 1)
        self.assertEqual(report["summary"]["authentication"]["dkim"], ["pass"])
        self.assertEqual(report["summary"]["recipient_count"], 1)

    def test_missing_required_headers_are_errors(self):
        report = analyze_email(b"Subject: Hello\n\nBody", now=self.now)
        codes = {row["code"] for row in report["findings"]}
        self.assertTrue({"missing-from", "missing-date", "missing-message-id"}.issubset(codes))
        self.assertEqual(report["status"], "error")

    def test_duplicate_singleton_is_error(self):
        raw = VALID.replace(b"Message-ID: <nightly-42@example.com>\n", b"Message-ID: <one@example.com>\nMessage-ID: <two@example.com>\n")
        report = analyze_email(raw, now=self.now)
        self.assertIn("duplicate-message-id", {row["code"] for row in report["findings"]})

    def test_invalid_date_is_error(self):
        raw = VALID.replace(b"Mon, 31 Aug 2026 09:15:00 +0000", b"not-a-date")
        report = analyze_email(raw, now=self.now)
        self.assertIn("invalid-date", {row["code"] for row in report["findings"]})

    def test_far_future_date_is_warning(self):
        raw = VALID.replace(b"Mon, 31 Aug 2026 09:15:00 +0000", b"Thu, 10 Sep 2026 09:15:00 +0000")
        report = analyze_email(raw, now=self.now)
        self.assertIn("future-date", {row["code"] for row in report["findings"]})

    def test_return_path_mismatch_is_cautious_warning(self):
        raw = VALID.replace(b"bounce@example.com", b"bounce@mailer.example.org")
        report = analyze_email(raw, now=self.now)
        finding = next(row for row in report["findings"] if row["code"] == "return-path-domain-mismatch")
        self.assertIn("can be legitimate", finding["message"])

    def test_body_headers_are_not_counted(self):
        raw = VALID + b"\nMessage-ID: <body-only@example.com>\n"
        report = analyze_email(raw, now=self.now)
        self.assertNotIn("duplicate-message-id", {row["code"] for row in report["findings"]})

    def test_empty_content_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "empty"):
            analyze_email(b"  \n")

    def test_non_bytes_input_is_rejected(self):
        with self.assertRaisesRegex(TypeError, "bytes"):
            analyze_email("From: a@example.com")

    def test_file_reader_enforces_size_limit(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "large.eml"
            path.write_bytes(b"x" * (MAX_FILE_BYTES + 1))
            with self.assertRaisesRegex(ValueError, "safety limit"):
                read_email_file(path)


if __name__ == "__main__":
    unittest.main()
