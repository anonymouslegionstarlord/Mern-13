from pathlib import Path
from tempfile import TemporaryDirectory
import json
import unittest

from dependencybrief.core import MAX_FILE_BYTES, analyze_path


class DependencyBriefTests(unittest.TestCase):
    def test_requirements_classifies_versions(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "requirements.txt"
            path.write_text("requests==2.32.3\nrich>=13,<14\nclick\n", encoding="utf-8")
            report = analyze_path(path)
            self.assertEqual(report["summary"]["by_status"]["pinned"], 1)
            self.assertEqual(report["summary"]["by_status"]["range"], 1)
            self.assertEqual(report["summary"]["by_status"]["unpinned"], 1)

    def test_package_json_reads_dependency_groups(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "package.json"
            path.write_text(json.dumps({"dependencies": {"react": "18.3.1"}, "devDependencies": {"vite": "^6.0.1"}}), encoding="utf-8")
            report = analyze_path(path)
            groups = {row["group"] for row in report["dependencies"]}
            self.assertEqual(groups, {"dependencies", "devDependencies"})
            self.assertEqual(report["summary"]["by_ecosystem"]["javascript"], 2)

    def test_pyproject_reads_optional_dependencies(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "pyproject.toml"
            path.write_text('[project]\nname="demo"\ndependencies=["httpx>=0.27"]\n[project.optional-dependencies]\ntest=["pytest==8.3.4"]\n', encoding="utf-8")
            report = analyze_path(path)
            self.assertEqual({row["group"] for row in report["dependencies"]}, {"runtime", "optional:test"})

    def test_directory_combines_supported_manifests(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "requirements.txt").write_text("requests==2.32.3\n", encoding="utf-8")
            (root / "package.json").write_text('{"dependencies":{"react":"18.3.1"}}', encoding="utf-8")
            report = analyze_path(root)
            self.assertEqual(report["summary"]["total"], 2)
            self.assertEqual(report["manifests"], ["requirements.txt", "package.json"])

    def test_invalid_json_becomes_error_finding(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "package.json"
            path.write_text("{broken", encoding="utf-8")
            report = analyze_path(path)
            self.assertEqual(report["status"], "error")
            self.assertIn("invalid-json", {row["code"] for row in report["findings"]})

    def test_requirement_include_is_not_followed(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "requirements.txt"
            path.write_text("-r private.txt\n", encoding="utf-8")
            report = analyze_path(path)
            self.assertIn("unsupported-include", {row["code"] for row in report["findings"]})

    def test_direct_url_is_reported(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "requirements.txt"
            path.write_text("demo @ https://example.com/demo.whl\n", encoding="utf-8")
            report = analyze_path(path)
            self.assertEqual(report["dependencies"][0]["status"], "direct")
            self.assertIn("direct-source", {row["code"] for row in report["findings"]})

    def test_conflicting_normalized_names_are_reported(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "requirements.txt"
            path.write_text("demo_pkg==1.0.0\ndemo-pkg==2.0.0\n", encoding="utf-8")
            report = analyze_path(path)
            self.assertIn("conflicting-declarations", {row["code"] for row in report["findings"]})

    def test_oversized_manifest_becomes_error(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "requirements.txt"
            path.write_bytes(b"x" * (MAX_FILE_BYTES + 1))
            report = analyze_path(path)
            self.assertIn("unreadable-manifest", {row["code"] for row in report["findings"]})

    def test_missing_manifests_are_rejected(self):
        with TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "No supported manifests"):
                analyze_path(directory)

    def test_unsupported_filename_is_rejected(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "deps.txt"
            path.write_text("requests", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Supported files"):
                analyze_path(path)


if __name__ == "__main__":
    unittest.main()
