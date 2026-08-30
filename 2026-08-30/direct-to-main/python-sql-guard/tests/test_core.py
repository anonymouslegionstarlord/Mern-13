import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from sqlguard.cli import main
from sqlguard.core import SqlGuardError, analyze, split_statements


class SQLGuardTests(unittest.TestCase):
    def test_split_respects_strings_and_comments(self):
        sql = "SELECT 'a;b'; -- ignored ;\nSELECT 2; /* ; */ SELECT 3"
        self.assertEqual(split_statements(sql), ["SELECT 'a;b'", "SELECT 2", "SELECT 3"])

    def test_doubled_quote_is_supported(self):
        self.assertEqual(split_statements("SELECT 'it''s safe';"), ["SELECT 'it''s safe'"])

    def test_empty_and_unterminated_input_is_rejected(self):
        with self.assertRaisesRegex(SqlGuardError, "No SQL"):
            split_statements("-- only a comment")
        with self.assertRaisesRegex(SqlGuardError, "unterminated"):
            split_statements("SELECT 'broken")
        with self.assertRaisesRegex(SqlGuardError, "unterminated"):
            split_statements("SELECT 1 /* broken")

    def test_update_and_delete_without_where_are_errors(self):
        report = analyze("UPDATE users SET active = 0; DELETE FROM logs;")
        self.assertEqual(report["counts"]["error"], 2)
        self.assertEqual({item["code"] for item in report["findings"]}, {"SQL002"})

    def test_where_prevents_mass_change_finding(self):
        report = analyze("UPDATE users SET active = 0 WHERE id = 7; DELETE FROM logs WHERE id = 2;")
        self.assertEqual(report["counts"]["error"], 0)

    def test_select_star_and_unbounded_select_warn(self):
        report = analyze("SELECT * FROM users;")
        self.assertEqual({item["code"] for item in report["findings"]}, {"SQL003", "SQL006"})

    def test_aggregate_and_limited_selects_are_not_unbounded(self):
        report = analyze("SELECT COUNT(*) FROM users; SELECT id FROM users LIMIT 10;")
        self.assertNotIn("SQL006", {item["code"] for item in report["findings"]})

    def test_null_comparison_and_insert_columns(self):
        report = analyze("SELECT id FROM users WHERE deleted_at = NULL LIMIT 5; INSERT INTO audit VALUES (1);")
        self.assertEqual({item["code"] for item in report["findings"]}, {"SQL004", "SQL005"})

    def test_destructive_statements_are_errors(self):
        report = analyze("DROP TABLE old_events; TRUNCATE TABLE queue;")
        self.assertEqual(report["counts"]["error"], 2)

    def test_cli_json_and_thresholds(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "query.sql"
            source.write_text("SELECT * FROM users LIMIT 5;\n", encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                warning_code = main([str(source), "--format", "json", "--fail-on", "warning"])
            self.assertEqual(warning_code, 1)
            self.assertEqual(json.loads(output.getvalue())["counts"]["warning"], 1)
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main([str(source), "--fail-on", "error"]), 0)


if __name__ == "__main__":
    unittest.main()
