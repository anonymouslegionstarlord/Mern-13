from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from cookiescope.cli import main
from cookiescope.core import CookieError, audit_headers, inspect_header


class CookieScopeTests(unittest.TestCase):
    def codes(self, header: str) -> set[str]:
        return {item.code for item in inspect_header(header).findings}

    def test_hardened_cookie_has_no_findings(self):
        result = inspect_header("sid=demo; Secure; HttpOnly; SameSite=Lax; Path=/")
        self.assertEqual(result.findings, ())

    def test_missing_defenses_are_warnings(self):
        self.assertEqual(
            self.codes("sid=demo"),
            {"SECURE_MISSING", "HTTPONLY_MISSING", "SAMESITE_MISSING"},
        )

    def test_same_site_none_requires_secure(self):
        self.assertIn("NONE_WITHOUT_SECURE", self.codes("sid=demo; HttpOnly; SameSite=None"))

    def test_invalid_same_site_is_error(self):
        self.assertIn("SAMESITE_INVALID", self.codes("sid=demo; Secure; HttpOnly; SameSite=Loose"))

    def test_host_prefix_rules(self):
        codes = self.codes("__Host-sid=demo; HttpOnly; SameSite=Lax; Domain=example.test")
        self.assertTrue({"HOST_SECURE", "HOST_PATH", "HOST_DOMAIN"}.issubset(codes))

    def test_secure_prefix_rule(self):
        self.assertIn("SECURE_PREFIX", self.codes("__Secure-sid=demo; HttpOnly; SameSite=Lax"))

    def test_duplicate_attributes_are_reported(self):
        self.assertIn(
            "DUPLICATE_ATTRIBUTE",
            self.codes("sid=demo; Secure; Secure; HttpOnly; SameSite=Lax"),
        )

    def test_invalid_expiry_and_max_age(self):
        codes = self.codes(
            "sid=demo; Secure; HttpOnly; SameSite=Lax; Expires=tomorrow; Max-Age=soon"
        )
        self.assertTrue({"EXPIRES_INVALID", "MAX_AGE_INVALID"}.issubset(codes))

    def test_invalid_cookie_name_is_rejected(self):
        with self.assertRaisesRegex(CookieError, "name"):
            inspect_header("bad name=demo")

    def test_report_never_contains_cookie_value(self):
        report = audit_headers(["sid=do-not-show; Secure; HttpOnly; SameSite=Lax"])
        self.assertNotIn("do-not-show", json.dumps(report))

    def test_parse_errors_are_collected_without_header_echo(self):
        report = audit_headers(["sid=demo; Secure; HttpOnly; SameSite=Lax", "broken"])
        self.assertEqual(report["summary"]["parse_errors"], 1)
        self.assertNotIn("broken", json.dumps(report))

    def test_cli_json_success(self):
        header = "sid=demo; Secure; HttpOnly; SameSite=Lax; Path=/"
        with patch("builtins.print") as mocked:
            code = main([header, "--format", "json"])
        self.assertEqual(code, 0)
        json.loads(mocked.call_args.args[0])


if __name__ == "__main__":
    unittest.main()

