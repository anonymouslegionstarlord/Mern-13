from pathlib import Path
import tempfile
import unittest
import warnings
import zipfile

from zipsentry.cli import main
from zipsentry.core import inspect_archive


class ZipSentryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def make_zip(self, name, members):
        path = self.root / name
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for member, content in members:
                archive.writestr(member, content)
        return path

    def test_clean_archive(self):
        report = inspect_archive(self.make_zip("clean.zip", [("docs/readme.txt", "hello")]))
        self.assertEqual((report.entries, report.errors, report.warnings), (1, 0, 0))

    def test_traversal_is_error(self):
        report = inspect_archive(self.make_zip("bad.zip", [("../escape.txt", "x")]))
        self.assertIn("path-traversal", {item.code for item in report.findings})

    def test_absolute_paths_are_errors(self):
        report = inspect_archive(self.make_zip("absolute.zip", [("/root", "x"), ("C:\\temp\\x", "x")]))
        self.assertEqual([item.code for item in report.findings].count("absolute-path"), 2)

    def test_duplicate_entry_is_warning(self):
        path = self.root / "duplicate.zip"
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("same.txt", "one")
                archive.writestr("same.txt", "two")
        self.assertIn("duplicate-entry", {item.code for item in inspect_archive(path).findings})

    def test_symlink_is_warning(self):
        path = self.root / "link.zip"
        info = zipfile.ZipInfo("shortcut")
        info.create_system = 3
        info.external_attr = 0o120777 << 16
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr(info, "target")
        self.assertIn("symbolic-link", {item.code for item in inspect_archive(path).findings})

    def test_high_ratio_is_warning(self):
        report = inspect_archive(self.make_zip("ratio.zip", [("zeros", "0" * 20_000)]), max_ratio=10)
        self.assertIn("compression-ratio", {item.code for item in report.findings})

    def test_total_size_limit(self):
        report = inspect_archive(self.make_zip("size.zip", [("data", "abcdef")]), max_uncompressed=3)
        self.assertIn("uncompressed-size-limit", {item.code for item in report.findings})

    def test_entry_limit(self):
        report = inspect_archive(self.make_zip("entries.zip", [("one", "1"), ("two", "2")]), max_entries=1)
        self.assertIn("entry-count-limit", {item.code for item in report.findings})

    def test_invalid_zip(self):
        path = self.root / "invalid.zip"
        path.write_text("not zip", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "could not inspect ZIP"):
            inspect_archive(path)

    def test_cli_threshold(self):
        path = self.make_zip("warning.zip", [("zeros", "0" * 20_000)])
        self.assertEqual(main([str(path), "--max-ratio", "10", "--fail-on", "error"]), 0)
        self.assertEqual(main([str(path), "--max-ratio", "10", "--fail-on", "warning"]), 1)


if __name__ == "__main__":
    unittest.main()
