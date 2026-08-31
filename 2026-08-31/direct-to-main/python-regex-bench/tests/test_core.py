import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from regexbench.cli import main
from regexbench.core import RegexBenchError, load_config, run_config


def config(pattern="a+", mode="fullmatch", flags=None, cases=None):
    return {"patterns": [{"name": "sample", "pattern": pattern, "mode": mode, "flags": flags or [], "cases": cases or [{"label": "case", "value": "aaa", "should_match": True}]}]}


class RegexBenchTests(unittest.TestCase):
    def test_fullmatch_passes_positive_and_negative_cases(self):
        report = run_config(config(cases=[
            {"label": "positive", "value": "aaa", "should_match": True},
            {"label": "negative", "value": "baa", "should_match": False},
        ]))
        self.assertEqual((report["passed"], report["failed"]), (2, 0))

    def test_search_reports_matched_text(self):
        report = run_config(config(pattern=r"QA-\d{4}", mode="search", cases=[{"label": "ticket", "value": "See QA-2048 now", "should_match": True}]))
        self.assertEqual(report["patterns"][0]["cases"][0]["matched_text"], "QA-2048")

    def test_flags_are_applied(self):
        report = run_config(config(pattern="hello", flags=["IGNORECASE"], cases=[{"label": "case", "value": "HELLO", "should_match": True}]))
        self.assertEqual(report["failed"], 0)

    def test_failed_expectation_is_counted(self):
        report = run_config(config(cases=[{"label": "wrong", "value": "bbb", "should_match": True}]))
        self.assertEqual(report["failed"], 1)

    def test_duplicate_names_are_rejected(self):
        data = config()
        data["patterns"].append(dict(data["patterns"][0]))
        with self.assertRaisesRegex(RegexBenchError, "Duplicate"):
            run_config(data)

    def test_invalid_regex_mode_and_flags_are_rejected(self):
        with self.assertRaisesRegex(RegexBenchError, "invalid"):
            run_config(config(pattern="["))
        with self.assertRaisesRegex(RegexBenchError, "mode"):
            run_config(config(mode="replace"))
        with self.assertRaisesRegex(RegexBenchError, "flags"):
            run_config(config(flags=["UNKNOWN"]))

    def test_case_schema_and_size_are_validated(self):
        with self.assertRaisesRegex(RegexBenchError, "should_match"):
            run_config(config(cases=[{"label": "bad", "value": "x", "should_match": "yes"}]))
        with self.assertRaisesRegex(RegexBenchError, "2000"):
            run_config(config(cases=[{"label": "large", "value": "x" * 2001, "should_match": True}]))

    def test_load_config_reports_invalid_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            path.write_text("{bad", encoding="utf-8")
            with self.assertRaisesRegex(RegexBenchError, "Invalid JSON"):
                load_config(path)

    def test_cli_json_success(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "patterns.json"
            path.write_text(json.dumps(config()), encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                code = main([str(path), "--format", "json"])
            self.assertEqual(code, 0)
            self.assertEqual(json.loads(output.getvalue())["passed"], 1)

    def test_cli_returns_one_for_failed_case(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "patterns.json"
            path.write_text(json.dumps(config(cases=[{"label": "wrong", "value": "b", "should_match": True}])), encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main([str(path)]), 1)


if __name__ == "__main__":
    unittest.main()
