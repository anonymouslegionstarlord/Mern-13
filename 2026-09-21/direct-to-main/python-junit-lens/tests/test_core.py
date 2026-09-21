from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from junitlens.cli import main
from junitlens.core import ReportError, analyze, parse_report


PASS = '<testsuite><testcase classname="demo" name="works" time="0.4"/></testsuite>'
FAIL = '<testsuite><testcase classname="demo" name="works" time="1.5"><failure/></testcase></testsuite>'


class JUnitLensTests(unittest.TestCase):
    def write(self, directory, name, content):
        path = Path(directory) / name
        path.write_text(content, encoding="utf-8")
        return path

    def test_parses_passed_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            item = parse_report(self.write(directory, "report.xml", PASS))[0]
            self.assertEqual((item.status, item.test_id, item.seconds), ("passed", "demo::works", 0.4))

    def test_failure_error_and_skip_precedence(self):
        xml = '<testsuite><testcase name="x"><skipped/><failure/><error/></testcase></testsuite>'
        with tempfile.TemporaryDirectory() as directory:
            item = parse_report(self.write(directory, "report.xml", xml))[0]
            self.assertEqual(item.status, "error")

    def test_directory_aggregation_and_flaky_detection(self):
        with tempfile.TemporaryDirectory() as directory:
            self.write(directory, "a.xml", PASS)
            self.write(directory, "b.xml", FAIL)
            report = analyze([directory], slow_seconds=1)
            self.assertEqual(report.status_counts["failed"], 1)
            self.assertEqual(report.flaky_tests, ("demo::works",))
            self.assertEqual(len(report.slow_tests), 1)

    def test_namespace_is_supported(self):
        xml = '<testsuite xmlns="urn:junit"><testcase classname="a" name="b"/></testsuite>'
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(len(parse_report(self.write(directory, "n.xml", xml))), 1)

    def test_missing_name_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write(directory, "bad.xml", '<testsuite><testcase/></testsuite>')
            with self.assertRaises(ReportError):
                parse_report(path)

    def test_negative_duration_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write(directory, "bad.xml", '<testsuite><testcase name="x" time="-1"/></testsuite>')
            with self.assertRaises(ReportError):
                parse_report(path)

    def test_invalid_root_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write(directory, "bad.xml", '<report/>')
            with self.assertRaises(ReportError):
                parse_report(path)

    def test_entity_declaration_is_rejected(self):
        xml = '<!DOCTYPE x [<!ENTITY y "z">]><testsuite/>'
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ReportError):
                parse_report(self.write(directory, "bad.xml", xml))

    def test_empty_directory_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ReportError):
                analyze([directory])

    def test_report_dictionary_contains_summary(self):
        with tempfile.TemporaryDirectory() as directory:
            report = analyze([self.write(directory, "report.xml", PASS)])
            self.assertTrue(report.to_dict()["summary"]["passed"])

    def test_cli_quality_gates(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write(directory, "report.xml", FAIL)
            self.assertEqual(main([str(path), "--fail-on", "failures"]), 1)
            self.assertEqual(main([str(path), "--fail-on", "none", "--format", "json"]), 0)


if __name__ == "__main__":
    unittest.main()

