import json
import tempfile
import unittest
from pathlib import Path

from jdmatch.analyzer import analyze, contains_term, load_catalog, validate_catalog


CATALOG = {
    "python": ["python3"],
    "react": ["react.js", "reactjs"],
    "rest api": ["restful api"],
    "sql": ["structured query language"],
}


class JDMatchTests(unittest.TestCase):
    def test_analysis_finds_aliases_and_missing_skills(self):
        report = analyze("Built React.js apps with Python3", "Need Python, React, SQL and RESTful API experience", CATALOG)
        self.assertEqual(report["matched"], ["python", "react"])
        self.assertEqual(report["missing"], ["rest api", "sql"])
        self.assertEqual(report["score"], 50.0)

    def test_term_matching_respects_boundaries(self):
        self.assertTrue(contains_term(" javascript ", "javascript"))
        self.assertFalse(contains_term(" javascript ", "java"))

    def test_empty_inputs_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "resume"):
            analyze(" ", "Python developer", CATALOG)
        with self.assertRaisesRegex(ValueError, "job description"):
            analyze("Python developer", " ", CATALOG)

    def test_no_catalogue_skills_returns_zero(self):
        report = analyze("Python", "Excellent communication", CATALOG)
        self.assertEqual(report["score"], 0.0)
        self.assertEqual(report["catalogue_skills_in_job"], 0)

    def test_catalog_validation(self):
        with self.assertRaisesRegex(ValueError, "non-empty"):
            validate_catalog({})
        with self.assertRaisesRegex(ValueError, "aliases"):
            validate_catalog({"python": "python3"})

    def test_load_custom_catalog(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "skills.json"
            path.write_text(json.dumps({"fastapi": ["fast api"]}), encoding="utf-8")
            self.assertEqual(load_catalog(path), {"fastapi": ["fast api"]})


if __name__ == "__main__":
    unittest.main()
