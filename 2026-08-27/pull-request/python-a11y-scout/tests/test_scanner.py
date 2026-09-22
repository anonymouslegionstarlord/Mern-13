import tempfile
import unittest
from pathlib import Path

from a11yscout.scanner import ScanError, discover_paths, scan_file, scan_html, scan_paths


HEAD = '<html lang="en"><head><meta name="viewport" content="width=device-width"><title>Test</title></head><body>'
TAIL = "</body></html>"


class A11yScoutTests(unittest.TestCase):
    def test_accessible_sample_has_no_issues(self):
        html = HEAD + '<h1>Profile</h1><img src="a.png" alt="Avatar"><label for="n">Name</label><input id="n"><a href="/help">Help</a><button>Save</button>' + TAIL
        self.assertEqual(scan_html(html), [])

    def test_document_basics_are_required(self):
        rules = {issue.rule for issue in scan_html("<body><p>Hello</p></body>")}
        self.assertEqual(rules, {"html-lang", "document-title", "viewport"})

    def test_image_alt_and_duplicate_ids_are_reported(self):
        html = HEAD + '<img id="same" src="a.png"><div id="same"></div>' + TAIL
        issues = scan_html(html)
        self.assertEqual({issue.rule for issue in issues}, {"image-alt", "duplicate-id"})

    def test_label_after_control_is_resolved(self):
        html = HEAD + '<input id="email"><label for="email">Email</label>' + TAIL
        self.assertNotIn("control-label", {issue.rule for issue in scan_html(html)})

    def test_empty_names_and_placeholder_link_are_reported(self):
        html = HEAD + '<a href="#"><span></span></a><button aria-label="Close"></button>' + TAIL
        rules = {issue.rule for issue in scan_html(html)}
        self.assertIn("a-name", rules)
        self.assertIn("link-target", rules)
        self.assertNotIn("button-name", rules)

    def test_heading_jump_is_a_warning(self):
        html = HEAD + "<h1>Title</h1><h3>Details</h3>" + TAIL
        issue = next(item for item in scan_html(html) if item.rule == "heading-order")
        self.assertEqual(issue.severity, "warning")

    def test_directory_scan_and_missing_path(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "good.html").write_text(HEAD + "<h1>Good</h1>" + TAIL, encoding="utf-8")
            nested = root / "nested"
            nested.mkdir()
            (nested / "bad.htm").write_text("<html><body><img></body></html>", encoding="utf-8")
            self.assertEqual(len(discover_paths([root])), 2)
            report = scan_paths([root])
            self.assertEqual(report["files_scanned"], 2)
            self.assertGreater(report["errors"], 0)
            with self.assertRaises(ScanError):
                scan_file(root / "missing.html")


if __name__ == "__main__":
    unittest.main()
