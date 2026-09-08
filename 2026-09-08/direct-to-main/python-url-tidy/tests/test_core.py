from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
import tempfile
import unittest

from urltidy.cli import main
from urltidy.core import analyze_url, audit_urls


class URLTidyTests(unittest.TestCase):
    def test_clean_url_normalizes_host_and_default_port(self):
        result = analyze_url("https://Example.COM:443/docs?id=7")
        self.assertEqual(result.sanitized, "https://example.com/docs?id=7")
        self.assertFalse(result.findings)

    def test_tracking_keys_are_removed(self):
        result = analyze_url("https://example.com/?utm_source=x&id=7&fbclid=abc")
        self.assertEqual(result.sanitized, "https://example.com/?id=7")
        self.assertIn("tracking-parameters", {item.code for item in result.findings})

    def test_duplicate_query_key_is_reported(self):
        result = analyze_url("https://example.com/?tag=a&tag=b")
        self.assertIn("duplicate-parameter", {item.code for item in result.findings})

    def test_credentials_are_removed(self):
        result = analyze_url("https://user:pass@example.com/private")
        self.assertEqual(result.sanitized, "https://example.com/private")
        self.assertIn("embedded-credentials", {item.code for item in result.findings})

    def test_http_and_fragment_are_warnings(self):
        result = analyze_url("http://example.com/page#part")
        self.assertEqual(result.sanitized, "http://example.com/page")
        self.assertEqual({item.code for item in result.findings}, {"cleartext-http", "fragment"})

    def test_unsupported_scheme_is_error(self):
        result = analyze_url("ftp://example.com/file")
        self.assertEqual(result.errors, 1)
        self.assertIsNone(result.sanitized)

    def test_invalid_port_is_error(self):
        result = analyze_url("https://example.com:nope/")
        self.assertIn("invalid-url", {item.code for item in result.findings})

    def test_audit_ignores_comments_and_blank_lines(self):
        report = audit_urls(["# demo", "", "https://example.com/"])
        self.assertEqual(len(report.results), 1)
        self.assertEqual(report.results[0].line, 3)

    def test_batch_limit_is_enforced(self):
        with self.assertRaisesRegex(ValueError, "limit is 1"):
            audit_urls(["https://one.test", "https://two.test"], max_urls=1)

    def test_cli_writes_clean_file_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "clean.txt"
            output = StringIO()
            with redirect_stdout(output):
                code = main(["https://example.com/?utm_source=x&id=1", "--write-clean", str(target)])
            self.assertEqual(code, 0)
            self.assertEqual(target.read_text(encoding="utf-8"), "https://example.com/?id=1\n")
            self.assertEqual(main(["https://example.com/", "--write-clean", str(target)]), 2)


if __name__ == "__main__":
    unittest.main()
