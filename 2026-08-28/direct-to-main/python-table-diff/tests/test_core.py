import tempfile
import unittest
from pathlib import Path

from tablediff.core import DiffError, Table, compare_tables, read_table


def table(rows, headers=("id", "name", "score")):
    return Table("memory.csv", headers, tuple(rows))


class TableDiffTests(unittest.TestCase):
    def test_read_table_validates_row_width(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.csv"
            path.write_text("id,name\n1,Asha,extra\n", encoding="utf-8")
            with self.assertRaisesRegex(DiffError, "cells"):
                read_table(path)

    def test_read_table_skips_blank_lines(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "blank-lines.csv"
            path.write_text("id,name\n1,Asha\n\n2,Ravi\n", encoding="utf-8")
            self.assertEqual(len(read_table(path).rows), 2)

    def test_duplicate_keys_are_rejected(self):
        old = table(({"id": "1", "name": "A", "score": "1"}, {"id": "1", "name": "B", "score": "2"}))
        with self.assertRaisesRegex(DiffError, "duplicate"):
            compare_tables(old, table(()), key="id")

    def test_added_removed_and_changed_rows(self):
        old = table(({"id": "1", "name": "A", "score": "1"}, {"id": "2", "name": "B", "score": "2"}))
        new = table(({"id": "1", "name": "A", "score": "3"}, {"id": "3", "name": "C", "score": "4"}))
        report = compare_tables(old, new, key="id")
        self.assertEqual((report["added_count"], report["removed_count"], report["changed_count"]), (1, 1, 1))
        self.assertEqual(report["changed"][0]["fields"][0]["column"], "score")

    def test_ignored_column_is_not_compared(self):
        old = table(({"id": "1", "name": "A", "score": "1"},))
        new = table(({"id": "1", "name": "A", "score": "9"},))
        self.assertEqual(compare_tables(old, new, key="id", ignore=["score"])["difference_count"], 0)

    def test_numeric_tolerance(self):
        old = table(({"id": "1", "name": "A", "score": "10.00"},))
        new = table(({"id": "1", "name": "A", "score": "10.009"},))
        self.assertEqual(compare_tables(old, new, key="id", numeric_tolerance="0.01")["difference_count"], 0)
        self.assertEqual(compare_tables(old, new, key="id", numeric_tolerance="0.001")["changed_count"], 1)

    def test_header_mismatch_is_rejected(self):
        old = table(())
        new = table((), headers=("id", "score", "name"))
        with self.assertRaisesRegex(DiffError, "headers"):
            compare_tables(old, new, key="id")

    def test_invalid_tolerance_and_ignore_are_rejected(self):
        source = table(())
        with self.assertRaises(DiffError):
            compare_tables(source, source, key="id", numeric_tolerance="NaN")
        with self.assertRaisesRegex(DiffError, "Ignored"):
            compare_tables(source, source, key="id", ignore=["missing"])


if __name__ == "__main__":
    unittest.main()
