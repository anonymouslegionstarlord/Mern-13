import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from changelogcraft.cli import main
from changelogcraft.core import CommitError, build_report, parse_commit, parse_lines, render_markdown


class ChangelogCraftTests(unittest.TestCase):
    def test_parse_scoped_commit(self):
        commit = parse_commit("feat(auth): add token rotation")
        self.assertEqual((commit.type, commit.scope, commit.description, commit.breaking), ("feat", "auth", "add token rotation", False))

    def test_parse_breaking_commit(self):
        commit = parse_commit("feat(api)!: remove legacy endpoint")
        self.assertTrue(commit.breaking)

    def test_invalid_and_unsupported_commits_are_rejected(self):
        with self.assertRaises(CommitError):
            parse_commit("not conventional")
        with self.assertRaisesRegex(CommitError, "Unsupported"):
            parse_commit("magic: ship it")

    def test_comments_blank_lines_and_allow_unparsed(self):
        commits, warnings = parse_lines(["# export", "", "Merge branch main", "fix: recover safely"], allow_unparsed=True)
        self.assertEqual(len(commits), 1)
        self.assertEqual(len(warnings), 1)
        self.assertIn("line 3", warnings[0])

    def test_strict_mode_reports_line_number(self):
        with self.assertRaisesRegex(CommitError, "line 2"):
            parse_lines(["fix: valid message", "broken"])

    def test_report_order_and_breaking_section(self):
        commits, _ = parse_lines(["fix(api): repair timeout", "feat(ui): add search", "feat(api)!: replace token format"])
        report = build_report(commits, title="1.2.0")
        self.assertEqual([section["name"] for section in report["sections"]], ["Features", "Fixes"])
        self.assertEqual(report["breaking_count"], 1)
        markdown = render_markdown(report)
        self.assertLess(markdown.index("## Breaking changes"), markdown.index("## Features"))

    def test_type_and_scope_filters(self):
        commits, _ = parse_lines(["feat(api): add route", "fix(api): fix route", "feat(ui): add card"])
        report = build_report(commits, include_types=["feat"], include_scopes=["api"])
        self.assertEqual(report["commit_count"], 1)
        self.assertEqual(report["sections"][0]["entries"][0]["description"], "add route")

    def test_invalid_filters_and_empty_results_are_rejected(self):
        commits, _ = parse_lines(["fix(api): repair timeout"])
        with self.assertRaisesRegex(CommitError, "Unknown"):
            build_report(commits, include_types=["unknown"])
        with self.assertRaisesRegex(CommitError, "No commits"):
            build_report(commits, include_scopes=["ui"])

    def test_cli_json_workflow(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "commits.txt"
            source.write_text("feat(api): add health route\nfix: handle failure\n", encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                code = main([str(source), "--format", "json"])
            self.assertEqual(code, 0)
            self.assertEqual(json.loads(output.getvalue())["commit_count"], 2)

    def test_empty_input_is_rejected(self):
        with self.assertRaisesRegex(CommitError, "No valid"):
            parse_lines(["", "# only a comment"])


if __name__ == "__main__":
    unittest.main()
