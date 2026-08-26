import json
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

from budgetbeacon.core import BudgetError, add_transaction, filter_month, load_transactions, save_transactions, summarize


class BudgetBeaconTests(unittest.TestCase):
    def test_add_transaction_normalizes_values(self):
        item = add_transaction("EXPENSE", "12.345", "  Home   Supplies ", on_date="2026-08-26", note="  pens   and paper ")
        self.assertEqual(item.amount, Decimal("12.35"))
        self.assertEqual(item.category, "Home Supplies")
        self.assertEqual(item.note, "pens and paper")

    def test_invalid_transaction_is_rejected(self):
        for amount in ("nope", 0, -1, "NaN"):
            with self.subTest(amount=amount), self.assertRaises(BudgetError):
                add_transaction("expense", amount, "Food", on_date="2026-08-26")
        with self.assertRaises(BudgetError):
            add_transaction("expense", 10, "Food", on_date="2026-02-30")

    def test_save_and_load_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "nested" / "budget.json"
            original = [add_transaction("income", 1000, "Salary", on_date="2026-08-01")]
            save_transactions(path, original)
            self.assertEqual(load_transactions(path), original)
            self.assertFalse(path.with_suffix(".json.tmp").exists())

    def test_load_rejects_duplicate_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "budget.json"
            item = add_transaction("expense", 10, "Food", on_date="2026-08-01").to_dict()
            path.write_text(json.dumps([item, item]), encoding="utf-8")
            with self.assertRaisesRegex(BudgetError, "duplicate"):
                load_transactions(path)

    def test_month_filter_validates_and_sorts(self):
        later = add_transaction("expense", 5, "Food", on_date="2026-08-20")
        earlier = add_transaction("expense", 4, "Food", on_date="2026-08-02")
        other = add_transaction("expense", 3, "Food", on_date="2026-09-01")
        self.assertEqual(filter_month([later, other, earlier], "2026-08"), [earlier, later])
        with self.assertRaises(BudgetError):
            filter_month([], "August")

    def test_summary_uses_decimal_math_and_flags_budget(self):
        items = [
            add_transaction("income", "1000", "Salary", on_date="2026-08-01"),
            add_transaction("expense", "250.50", "Food", on_date="2026-08-02"),
            add_transaction("expense", "100", "Travel", on_date="2026-08-03"),
        ]
        report = summarize(items, month="2026-08", budgets={"Food": "200", "Travel": "150"})
        self.assertEqual(report["balance"], "649.50")
        self.assertEqual(report["savings_rate_percent"], "64.95")
        self.assertEqual([item["category"] for item in report["overspent"]], ["Food"])


if __name__ == "__main__":
    unittest.main()
