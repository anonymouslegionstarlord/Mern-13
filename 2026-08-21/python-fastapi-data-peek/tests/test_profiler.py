import unittest

from app.profiler import ProfileError, infer_type, parse_csv, profile_csv


class ProfilerTests(unittest.TestCase):
    def test_profiles_shape_missing_and_numeric_values(self):
        csv_data = b"name,score,active\nAsha,10,true\nBen,,false\nChen,20,true\n"
        report = profile_csv(csv_data)
        self.assertEqual((report["rows"], report["columns"]), (3, 3))
        self.assertEqual(report["missing_cells"], 1)
        score = report["column_profiles"][1]
        self.assertEqual(score["type"], "integer")
        self.assertEqual(score["numeric"]["mean"], 15.0)

    def test_supports_custom_delimiter(self):
        headers, rows = parse_csv(b"city;temp\nDelhi;32.5\n", ";")
        self.assertEqual(headers, ["city", "temp"])
        self.assertEqual(rows[0][1], "32.5")

    def test_infers_common_types(self):
        self.assertEqual(infer_type(["1", "-2"]), "integer")
        self.assertEqual(infer_type(["1.2", "3"]), "decimal")
        self.assertEqual(infer_type(["yes", "no"]), "boolean")
        self.assertEqual(infer_type(["2026-08-21"]), "date")
        self.assertEqual(infer_type(["Delhi"]), "text")

    def test_rejects_duplicate_headers(self):
        with self.assertRaisesRegex(ProfileError, "unique"):
            parse_csv(b"Name,name\nA,B\n")

    def test_rejects_wrong_row_width(self):
        with self.assertRaisesRegex(ProfileError, "row 2"):
            parse_csv(b"a,b\n1,2,3\n")

    def test_rejects_non_utf8(self):
        with self.assertRaisesRegex(ProfileError, "UTF-8"):
            parse_csv(b"name\n\xff\n")

    def test_empty_data_rows_are_valid(self):
        report = profile_csv(b"name,score\n")
        self.assertEqual(report["rows"], 0)
        self.assertEqual(report["completeness_percent"], 100.0)


if __name__ == "__main__":
    unittest.main()

