import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from localeparity.cli import main
from localeparity.core import LocaleError, compare, flatten, load_locale, placeholders


class LocaleParityTests(unittest.TestCase):
    def test_nested_files_with_matching_structure_pass(self):
        report = compare({"app": {"title": "Title"}}, {"app": {"title": "शीर्षक"}})
        self.assertEqual((report["errors"], report["warnings"]), (0, 0))

    def test_missing_and_extra_keys_are_reported(self):
        report = compare({"a": "A", "b": "B"}, {"a": "एक", "c": "सी"})
        self.assertEqual({item["code"] for item in report["findings"]}, {"LOC001", "LOC002"})

    def test_type_mismatch_is_reported(self):
        report = compare({"count": 2}, {"count": "दो"})
        self.assertEqual(report["findings"][0]["code"], "LOC003")

    def test_placeholder_mismatch_is_reported(self):
        report = compare({"welcome": "Hello, {name}"}, {"welcome": "Hello, {user}"})
        self.assertEqual(report["findings"][0]["code"], "LOC004")

    def test_brace_and_percent_placeholders_are_extracted(self):
        self.assertEqual(placeholders("Hi {name}: %(count)d"), {"{name}", "%(count)d"})

    def test_percent_placeholder_type_mismatch_is_reported(self):
        report = compare({"items": "%(count)d items"}, {"items": "%(count)s items"})
        self.assertEqual(report["findings"][0]["code"], "LOC004")

    def test_empty_translation_is_a_warning(self):
        report = compare({"save": "Save"}, {"save": "  "})
        self.assertEqual((report["errors"], report["warnings"]), (0, 1))

    def test_flatten_preserves_nested_paths(self):
        self.assertEqual(flatten({"app": {"menu": {"save": "Save"}}}), {"app.menu.save": "Save"})

    def test_duplicate_json_keys_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "duplicate.json"
            path.write_text('{"save":"Save","save":"Again"}', encoding="utf-8")
            with self.assertRaisesRegex(LocaleError, "Duplicate"):
                load_locale(path)

    def test_invalid_root_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "array.json"
            path.write_text("[]", encoding="utf-8")
            with self.assertRaisesRegex(LocaleError, "object"):
                load_locale(path)

    def test_cli_json_success_and_warning_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            reference = Path(directory) / "en.json"
            target = Path(directory) / "hi.json"
            reference.write_text(json.dumps({"save": "Save"}), encoding="utf-8")
            target.write_text(json.dumps({"save": ""}), encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                code = main([str(reference), str(target), "--format", "json"])
            self.assertEqual(code, 0)
            self.assertEqual(json.loads(output.getvalue())["warnings"], 1)
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main([str(reference), str(target), "--fail-on", "warning"]), 1)


if __name__ == "__main__":
    unittest.main()
