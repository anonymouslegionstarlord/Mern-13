import csv
import tempfile
import unittest
from pathlib import Path

from caseforge.models import TestCase
from caseforge.store import CaseStore


class CaseForgeTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.store = CaseStore(self.root / "cases.json")

    def tearDown(self):
        self.temp_dir.cleanup()

    def add_case(self):
        return self.store.add("Valid login", ["Open login", "Enter credentials", "Submit"], "Dashboard opens", "High", "Functional")

    def test_add_and_filter_case(self):
        created = self.add_case()
        self.assertEqual(created.id, 1)
        self.assertEqual(len(self.store.list(status="Not Run", priority="High")), 1)
        self.assertEqual(self.store.list(priority="Low"), [])

    def test_execution_requires_actual_result(self):
        created = self.add_case()
        with self.assertRaisesRegex(ValueError, "actual result"):
            self.store.update(created.id, "Failed", "")

    def test_update_and_summary(self):
        created = self.add_case()
        self.store.update(created.id, "Passed", "Dashboard opened")
        summary = self.store.summary()
        self.assertEqual(summary["executed"], 1)
        self.assertEqual(summary["pass_rate"], 100.0)

    def test_csv_export(self):
        self.add_case()
        output = self.store.export_csv(self.root / "report.csv")
        with output.open(newline="", encoding="utf-8") as handle:
            rows = list(csv.reader(handle))
        self.assertEqual(rows[0][0:3], ["ID", "Title", "Priority"])
        self.assertEqual(rows[1][1], "Valid login")

    def test_model_rejects_missing_steps(self):
        case = TestCase(id=1, title="A valid title", steps=[], expected="Expected output")
        with self.assertRaisesRegex(ValueError, "at least one"):
            case.validate()


if __name__ == "__main__":
    unittest.main()
