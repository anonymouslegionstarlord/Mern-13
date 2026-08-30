import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from readabilitybench.cli import main
from readabilitybench.core import MAX_CHARACTERS, ReadabilityError, analyze, count_syllables


class ReadabilityBenchTests(unittest.TestCase):
    def test_syllable_heuristic(self):
        self.assertEqual(count_syllables("cat"), 1)
        self.assertEqual(count_syllables("banana"), 3)
        self.assertEqual(count_syllables("table"), 2)

    def test_counts_and_reading_time(self):
        report = analyze("Clear writing helps readers. Short examples build confidence.")
        self.assertEqual(report["sentences"], 2)
        self.assertEqual(report["paragraphs"], 1)
        self.assertEqual(report["words"], 8)
        self.assertEqual(report["reading_minutes"], 0.04)

    def test_paragraph_count(self):
        report = analyze("First short paragraph.\n\nSecond short paragraph.")
        self.assertEqual(report["paragraphs"], 2)

    def test_invalid_short_and_large_input(self):
        with self.assertRaisesRegex(ReadabilityError, "three"):
            analyze("Too short")
        with self.assertRaisesRegex(ReadabilityError, "safety"):
            analyze("a" * (MAX_CHARACTERS + 1))

    def test_long_sentence_recommendation(self):
        sentence = " ".join(["word"] * 30) + "."
        report = analyze(sentence)
        self.assertEqual(report["long_sentences"], 1)
        self.assertTrue(any("Split" in item for item in report["recommendations"]))

    def test_long_paragraph_recommendation(self):
        paragraph = " ".join(["word"] * 121) + "."
        report = analyze(paragraph)
        self.assertEqual(report["long_paragraphs"], 1)

    def test_passive_voice_signal(self):
        report = analyze("The report was completed by the team. Everyone reviewed it.")
        self.assertEqual(report["passive_voice_signals"], 1)

    def test_complex_words_are_ranked(self):
        report = analyze("Accessibility improves interoperability. Accessibility supports participation.")
        self.assertEqual(report["top_complex_words"][0]["word"], "accessibility")
        self.assertEqual(report["top_complex_words"][0]["count"], 2)

    def test_cli_json_workflow(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "article.txt"
            source.write_text("Clear instructions help people finish tasks. Useful examples reduce mistakes.", encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                code = main([str(source), "--format", "json"])
            self.assertEqual(code, 0)
            self.assertGreater(json.loads(output.getvalue())["words"], 5)

    def test_cli_grade_gate_and_invalid_target(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "article.txt"
            source.write_text("Interdisciplinary conceptualization complicates organizational communication significantly.", encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main([str(source), "--max-grade", "1"]), 1)
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(main([str(source), "--max-grade", "21"]), 2)


if __name__ == "__main__":
    unittest.main()
