from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from aclinsight.cli import main
from aclinsight.core import ACLInputError, audit_csv, parse_network, parse_port


FIELDS = ["rule_id", "action", "protocol", "source", "destination", "source_port", "destination_port", "enabled"]


class ACLInsightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def write(self, rows, fields=FIELDS):
        path = self.root / "rules.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)
        return path

    def row(self, **changes):
        value = {
            "rule_id": "RULE-1", "action": "allow", "protocol": "tcp",
            "source": "10.0.0.0/24", "destination": "10.1.0.10/32",
            "source_port": "any", "destination_port": "443", "enabled": "true",
        }
        value.update(changes)
        return value

    def codes(self, rows):
        return {item["code"] for item in audit_csv(self.write(rows))["findings"]}

    def test_network_normalizes_host_bits(self):
        self.assertEqual(str(parse_network("10.0.0.9/24")), "10.0.0.0/24")

    def test_port_range(self):
        self.assertEqual(parse_port("1000-2000"), (1000, 2000))

    def test_invalid_port_order(self):
        with self.assertRaisesRegex(ValueError, "ordered"):
            parse_port("200-100")

    def test_missing_columns(self):
        with self.assertRaisesRegex(ACLInputError, "missing columns"):
            audit_csv(self.write([], fields=["rule_id"]))

    def test_invalid_row_is_collected(self):
        report = audit_csv(self.write([self.row(action="accept")]))
        self.assertEqual(report["summary"]["invalid_rows"], 1)

    def test_broad_allow(self):
        self.assertIn("BROAD_ALLOW", self.codes([self.row(source="any", destination="any")]))

    def test_exposed_admin(self):
        self.assertIn("EXPOSED_ADMIN", self.codes([self.row(source="any", destination_port="22")]))

    def test_redundant_rule(self):
        first = self.row(rule_id="ALL", source="any", destination="any", destination_port="any")
        second = self.row(rule_id="WEB")
        self.assertIn("REDUNDANT", self.codes([first, second]))

    def test_shadowed_rule(self):
        first = self.row(rule_id="DENY", action="deny", source="any", destination="any", destination_port="any")
        second = self.row(rule_id="WEB")
        self.assertIn("SHADOWED", self.codes([first, second]))

    def test_duplicate_rule_id(self):
        self.assertIn("DUPLICATE_ID", self.codes([self.row(), self.row()]))

    def test_disabled_rule_is_info_only(self):
        self.assertEqual(self.codes([self.row(enabled="false")]), {"DISABLED"})

    def test_cli_json_success(self):
        path = self.write([self.row()])
        with patch("builtins.print") as mocked:
            code = main([str(path), "--format", "json"])
        self.assertEqual(code, 0)
        json.loads(mocked.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
