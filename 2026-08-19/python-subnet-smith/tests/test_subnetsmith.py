import csv
import tempfile
import unittest
from pathlib import Path

from subnetsmith.calculator import contains, describe, export_csv, split_network


class SubnetSmithTests(unittest.TestCase):
    def test_describe_ipv4_network(self):
        result = describe("192.168.10.0/24")
        self.assertEqual(result["netmask"], "255.255.255.0")
        self.assertEqual(result["usable_addresses"], 254)
        self.assertEqual(result["first_usable"], "192.168.10.1")

    def test_host_bits_are_rejected_by_default(self):
        with self.assertRaisesRegex(ValueError, "host bits set"):
            describe("192.168.10.42/24")
        self.assertEqual(describe("192.168.10.42/24", strict=False)["network"], "192.168.10.0/24")

    def test_split_network(self):
        subnets = split_network("10.0.0.0/24", 26)
        self.assertEqual([str(item) for item in subnets], ["10.0.0.0/26", "10.0.0.64/26", "10.0.0.128/26", "10.0.0.192/26"])

    def test_invalid_split_prefix(self):
        with self.assertRaisesRegex(ValueError, "new prefix"):
            split_network("10.0.0.0/24", 20)

    def test_contains_address_and_subnet(self):
        self.assertTrue(contains("172.16.0.0/16", "172.16.4.9"))
        self.assertTrue(contains("172.16.0.0/16", "172.16.8.0/24"))
        self.assertFalse(contains("172.16.0.0/16", "172.17.0.1"))

    def test_ipv6_description(self):
        result = describe("2001:db8::/126")
        self.assertEqual(result["version"], 6)
        self.assertEqual(result["total_addresses"], 4)

    def test_csv_export(self):
        with tempfile.TemporaryDirectory() as directory:
            output = export_csv("192.0.2.0/24", 26, Path(directory) / "plan.csv")
            with output.open(newline="", encoding="utf-8") as handle:
                rows = list(csv.reader(handle))
            self.assertEqual(len(rows), 5)
            self.assertEqual(rows[1][0], "192.0.2.0/26")


if __name__ == "__main__":
    unittest.main()
