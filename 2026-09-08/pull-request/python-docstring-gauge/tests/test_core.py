from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
import tempfile
import unittest

from docstring_gauge.cli import main
from docstring_gauge.core import scan_paths


class DocstringGaugeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def test_documented_module_and_function(self):
        path = self.write("good.py", '"""Module."""\n\ndef work():\n    """Work."""\n')
        report = scan_paths([path])
        self.assertEqual((len(report.definitions), report.documented, report.coverage), (2, 2, 100.0))

    def test_missing_docstring_reduces_coverage(self):
        path = self.write("mixed.py", '"""Module."""\n\ndef work():\n    return 1\n')
        report = scan_paths([path])
        self.assertEqual(report.coverage, 50.0)

    def test_private_definitions_ignored_by_default(self):
        path = self.write("private.py", '"""Module."""\n\ndef _helper():\n    pass\n')
        self.assertEqual(len(scan_paths([path]).definitions), 1)
        self.assertEqual(len(scan_paths([path], include_private=True).definitions), 2)

    def test_class_method_name_is_qualified(self):
        path = self.write("service.py", '"""Module."""\n\nclass Service:\n    """Service."""\n    def run(self):\n        pass\n')
        names = {item.name for item in scan_paths([path]).definitions}
        self.assertIn("Service.run", names)

    def test_async_function_kind(self):
        path = self.write("async_app.py", '"""Module."""\n\nasync def fetch():\n    """Fetch."""\n')
        kinds = {item.kind for item in scan_paths([path]).definitions}
        self.assertIn("async-function", kinds)

    def test_syntax_error_is_finding(self):
        path = self.write("broken.py", "def broken(:\n")
        report = scan_paths([path])
        self.assertEqual(report.findings[0].code, "syntax-error")

    def test_directory_scan_and_glob_exclusion(self):
        self.write("keep.py", '"""Keep."""\n')
        self.write("migrations/skip.py", "def undocumented():\n    pass\n")
        report = scan_paths([self.root], excludes=("*/migrations/*",))
        self.assertEqual(report.files, 1)

    def test_no_modules_option(self):
        path = self.write("plain.py", '"""Module."""\n\ndef work():\n    """Work."""\n')
        report = scan_paths([path], include_modules=False)
        self.assertEqual(len(report.definitions), 1)
        self.assertEqual(report.definitions[0].kind, "function")

    def test_file_limit(self):
        self.write("one.py", '"""One."""\n')
        self.write("two.py", '"""Two."""\n')
        with self.assertRaisesRegex(ValueError, "limit is 1"):
            scan_paths([self.root], max_files=1)

    def test_cli_minimum_gate(self):
        path = self.write("gate.py", '"""Module."""\n\ndef missing():\n    pass\n')
        output = StringIO()
        with redirect_stdout(output):
            code = main([str(path), "--minimum", "80"])
        self.assertEqual(code, 1)
        self.assertIn("Coverage: 50.0%", output.getvalue())


if __name__ == "__main__":
    unittest.main()
