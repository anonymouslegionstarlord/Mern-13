import csv
import io
import tempfile
import unittest
from pathlib import Path

from pairwiseforge.core import ConfigError, canonical, case_pairs, generate, load_config, render_csv


class PairwiseForgeTests(unittest.TestCase):
    def setUp(self):
        self.config = {
            "parameters": {
                "browser": ["Chrome", "Firefox", "Safari"],
                "os": ["Windows", "Linux"],
                "account": ["free", "team"],
            },
            "exclude": [{"browser": "Safari", "os": "Linux"}],
        }

    def test_generated_cases_cover_every_achievable_pair(self):
        report = generate(self.config)
        names = report["parameters"]
        generated_pairs = set().union(*(case_pairs(case, names) for case in report["cases"]))
        all_valid = []
        for browser in self.config["parameters"]["browser"]:
            for os_name in self.config["parameters"]["os"]:
                for account in self.config["parameters"]["account"]:
                    if not (browser == "Safari" and os_name == "Linux"):
                        all_valid.append({"browser": browser, "os": os_name, "account": account})
        expected_pairs = set().union(*(case_pairs(case, names) for case in all_valid))
        self.assertEqual(generated_pairs, expected_pairs)
        self.assertEqual(report["coverage_percent"], 100)

    def test_excluded_combinations_never_appear(self):
        report = generate(self.config)
        self.assertFalse(any(case["browser"] == "Safari" and case["os"] == "Linux" for case in report["cases"]))

    def test_generation_is_deterministic(self):
        self.assertEqual(generate(self.config)["cases"], generate(self.config)["cases"])

    def test_single_parameter_emits_each_value(self):
        report = generate({"parameters": {"theme": ["light", "dark", "system"]}})
        self.assertEqual([case["theme"] for case in report["cases"]], ["light", "dark", "system"])
        self.assertEqual(report["pair_count"], 0)

    def test_invalid_and_duplicate_values_are_rejected(self):
        with self.assertRaisesRegex(ConfigError, "non-empty"):
            generate({"parameters": {}})
        with self.assertRaisesRegex(ConfigError, "duplicate"):
            generate({"parameters": {"browser": ["Chrome", "Chrome"]}})
        with self.assertRaisesRegex(ConfigError, "JSON strings"):
            generate({"parameters": {"browser": [["nested"]]}})

    def test_unreachable_values_are_rejected(self):
        config = {"parameters": {"a": [1, 2], "b": ["x"]}, "exclude": [{"a": 2}]}
        with self.assertRaisesRegex(ConfigError, "unreachable"):
            generate(config)

    def test_candidate_safety_limit(self):
        config = {"parameters": {"a": list(range(50)), "b": list(range(50)), "c": list(range(50))}}
        with self.assertRaisesRegex(ConfigError, "limit"):
            generate(config)

    def test_csv_renderer_has_headers_and_all_cases(self):
        report = generate(self.config)
        rows = list(csv.DictReader(io.StringIO(render_csv(report))))
        self.assertEqual(len(rows), report["case_count"])
        self.assertEqual(list(rows[0]), report["parameters"])

    def test_load_config_reports_invalid_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "broken.json"
            path.write_text("{broken", encoding="utf-8")
            with self.assertRaisesRegex(ConfigError, "Invalid JSON"):
                load_config(path)

    def test_canonical_distinguishes_boolean_and_integer(self):
        self.assertNotEqual(canonical(True), canonical(1))


if __name__ == "__main__":
    unittest.main()
