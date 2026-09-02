from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from markdownroute.core import MAX_FILE_BYTES, audit_markdown


class MarkdownRouteTests(unittest.TestCase):
    def test_valid_file_and_fragment_pass(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "README.md").write_text("# Home\n[Guide](guide.md#getting-started)\n", encoding="utf-8")
            (root / "guide.md").write_text("# Getting Started\n[Home](README.md#home)\n", encoding="utf-8")
            report = audit_markdown(root)
            self.assertEqual(report["status"], "ok")
            self.assertEqual(report["summary"]["local_links"], 2)

    def test_missing_file_is_error(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "README.md"
            path.write_text("[Missing](nope.md)\n", encoding="utf-8")
            report = audit_markdown(path)
            self.assertIn("missing-target", {row["code"] for row in report["findings"]})

    def test_missing_fragment_is_error(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "README.md"
            path.write_text("# Present\n[Wrong](#absent)\n", encoding="utf-8")
            report = audit_markdown(path)
            self.assertIn("missing-anchor", {row["code"] for row in report["findings"]})

    def test_duplicate_headings_get_numbered_anchors(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "README.md"
            path.write_text("# Repeat\n## Repeat\n[Second](#repeat-1)\n", encoding="utf-8")
            self.assertEqual(audit_markdown(path)["status"], "ok")

    def test_fenced_code_links_are_ignored(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "README.md"
            path.write_text("```md\n[Fake](missing.md)\n```\n", encoding="utf-8")
            report = audit_markdown(path)
            self.assertEqual(report["summary"]["local_links"], 0)

    def test_external_links_are_not_fetched(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "README.md"
            path.write_text("[Example](https://example.com/docs)\n", encoding="utf-8")
            report = audit_markdown(path)
            self.assertEqual(report["status"], "ok")
            self.assertEqual(report["summary"]["external_links"], 1)

    def test_root_escape_is_error(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            docs = root / "docs"
            docs.mkdir()
            (root / "outside.md").write_text("# Outside", encoding="utf-8")
            (docs / "README.md").write_text("[Outside](../outside.md)\n", encoding="utf-8")
            report = audit_markdown(docs)
            self.assertIn("root-escape", {row["code"] for row in report["findings"]})

    def test_absolute_path_is_warning(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "README.md"
            path.write_text("[Root](/docs/start.md)\n", encoding="utf-8")
            report = audit_markdown(path)
            self.assertIn("absolute-path", {row["code"] for row in report["findings"]})

    def test_oversized_file_is_reported(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "README.md"
            path.write_bytes(b"x" * (MAX_FILE_BYTES + 1))
            report = audit_markdown(path)
            self.assertIn("unreadable-file", {row["code"] for row in report["findings"]})

    def test_non_markdown_file_is_rejected(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "notes.txt"
            path.write_text("notes", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, ".md"):
                audit_markdown(path)


if __name__ == "__main__":
    unittest.main()
