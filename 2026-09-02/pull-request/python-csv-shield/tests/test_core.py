from pathlib import Path
from tempfile import TemporaryDirectory
import csv
import unittest

from csvshield.core import audit_csv, is_formula_risk, sanitize_csv


class CSVShieldTests(unittest.TestCase):
    def make_file(self, directory: str, text: str, name: str = "data.csv") -> Path:
        path = Path(directory) / name
        path.write_text(text, encoding="utf-8")
        return path

    def test_clean_csv_passes(self):
        with TemporaryDirectory() as directory:
            report = audit_csv(self.make_file(directory, "name,score\nAsha,8\n"))
            self.assertEqual(report["status"], "ok")
            self.assertEqual(report["summary"]["data_rows"], 1)

    def test_formula_prefixes_are_flagged(self):
        with TemporaryDirectory() as directory:
            report = audit_csv(self.make_file(directory, "name,note\nAsha,=2+2\nBen,@SUM(A1)\n"))
            self.assertEqual(report["summary"]["formula_risk_cells"], 2)
            self.assertEqual(report["status"], "warning")

    def test_signed_numbers_are_not_formula_risks(self):
        self.assertFalse(is_formula_risk("-12.5"))
        self.assertFalse(is_formula_risk("+3e2"))
        self.assertTrue(is_formula_risk("+cmd"))

    def test_duplicate_headers_are_errors(self):
        with TemporaryDirectory() as directory:
            report = audit_csv(self.make_file(directory, "name,Name\nA,B\n"))
            self.assertIn("duplicate-header", {row["code"] for row in report["findings"]})
            self.assertEqual(report["status"], "error")

    def test_row_width_mismatch_is_error(self):
        with TemporaryDirectory() as directory:
            report = audit_csv(self.make_file(directory, "a,b\n1\n"))
            self.assertIn("row-width", {row["code"] for row in report["findings"]})

    def test_control_character_is_warning(self):
        with TemporaryDirectory() as directory:
            report = audit_csv(self.make_file(directory, "a,b\n1,hello\x00world\n"))
            self.assertIn("control-character", {row["code"] for row in report["findings"]})

    def test_long_cell_threshold_is_configurable(self):
        with TemporaryDirectory() as directory:
            report = audit_csv(self.make_file(directory, "a,b\n1,abcdefghijk\n"), max_cell_length=10)
            self.assertIn("long-cell", {row["code"] for row in report["findings"]})

    def test_semicolon_delimiter(self):
        with TemporaryDirectory() as directory:
            report = audit_csv(self.make_file(directory, "a;b\n1;2\n"), delimiter=";")
            self.assertEqual(report["summary"]["columns"], 2)
            self.assertEqual(report["summary"]["delimiter"], "semicolon")

    def test_sanitizer_prefixes_risky_cells(self):
        with TemporaryDirectory() as directory:
            source = self.make_file(directory, "name,note\nAsha,=2+2\n")
            destination = Path(directory) / "safe.csv"
            self.assertEqual(sanitize_csv(source, destination), 1)
            with destination.open(encoding="utf-8", newline="") as handle:
                rows = list(csv.reader(handle))
            self.assertEqual(rows[1][1], "'=2+2")
            self.assertEqual(audit_csv(destination)["status"], "ok")

    def test_sanitizer_never_overwrites(self):
        with TemporaryDirectory() as directory:
            source = self.make_file(directory, "a\n1\n")
            with self.assertRaisesRegex(ValueError, "must not overwrite"):
                sanitize_csv(source, source)

    def test_invalid_max_length_is_rejected(self):
        with TemporaryDirectory() as directory:
            source = self.make_file(directory, "a\n1\n")
            with self.assertRaisesRegex(ValueError, "10 to 100000"):
                audit_csv(source, max_cell_length=1)


if __name__ == "__main__":
    unittest.main()
