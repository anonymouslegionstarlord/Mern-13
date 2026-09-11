import json
import tempfile
import unittest
from pathlib import Path
from envguard.parser import EnvError, parse_env_text
from envguard.validator import load_schema, validate_environment

SCHEMA = {
    "PORT": {"required": True, "type": "integer", "min": 1, "max": 65535},
    "DEBUG": {"required": True, "type": "boolean"},
    "MODE": {"type": "enum", "enum": ["dev", "prod"]},
    "TOKEN": {"required": True, "type": "string", "secret": True, "min_length": 8},
}

class EnvGuardTests(unittest.TestCase):
    def test_parses_comments_export_and_quotes(self):
        values = parse_env_text('# comment\nexport PORT=8000\nNAME="Mayank"\n')
        self.assertEqual(values, {"PORT": "8000", "NAME": "Mayank"})

    def test_rejects_duplicate_and_invalid_lines(self):
        with self.assertRaisesRegex(EnvError, "duplicates"): parse_env_text("PORT=1\nPORT=2\n")
        with self.assertRaisesRegex(EnvError, "KEY=VALUE"): parse_env_text("PORT 8000")

    def test_valid_environment(self):
        report = validate_environment({"PORT": "8000", "DEBUG": "false", "MODE": "prod", "TOKEN": "local-abc123"}, SCHEMA)
        self.assertTrue(report["valid"]); self.assertEqual(report["issues"], [])

    def test_reports_missing_invalid_and_extra_without_values(self):
        report = validate_environment({"PORT": "70000", "DEBUG": "maybe", "EXTRA": "private-value"}, SCHEMA)
        self.assertFalse(report["valid"]); codes = {item["code"] for item in report["issues"]}
        self.assertTrue({"maximum", "type", "missing", "unexpected"}.issubset(codes))
        self.assertNotIn("private-value", json.dumps(report))

    def test_detects_placeholder_secret(self):
        report = validate_environment({"PORT": "80", "DEBUG": "true", "TOKEN": "change-me"}, SCHEMA)
        self.assertIn("placeholder_secret", {item["code"] for item in report["issues"]})

    def test_allow_extra(self):
        report = validate_environment({"PORT": "80", "DEBUG": "true", "TOKEN": "long-token", "EXTRA": "ok"}, SCHEMA, allow_extra=True)
        self.assertTrue(report["valid"])

    def test_load_schema_rejects_bad_type_and_pattern(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "schema.json"
            path.write_text(json.dumps({"PORT": {"type": "magic"}}), encoding="utf-8")
            with self.assertRaisesRegex(EnvError, "unsupported"): load_schema(path)
            path.write_text(json.dumps({"KEY": {"pattern": "["}}), encoding="utf-8")
            with self.assertRaisesRegex(EnvError, "invalid pattern"): load_schema(path)

if __name__ == "__main__": unittest.main()

