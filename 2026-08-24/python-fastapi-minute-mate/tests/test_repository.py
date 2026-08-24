import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from app.repository import Repository, RepositoryError

class RepositoryTests(unittest.TestCase):
    def setUp(self): self.temp = tempfile.TemporaryDirectory(); self.repo = Repository(Path(self.temp.name) / "test.db")
    def tearDown(self): self.temp.cleanup()
    def meeting(self): return self.repo.create_meeting("Sprint planning", "2026-08-24", "Plan the sprint", "Team agreed scope", ["Mayank", "Asha"])
    def test_create_and_get_meeting(self):
        meeting = self.meeting(); loaded = self.repo.get_meeting(meeting["id"]); self.assertEqual(loaded["attendees"], ["Mayank", "Asha"]); self.assertEqual(loaded["actions"], [])
    def test_search_meetings(self):
        self.meeting(); self.repo.create_meeting("Retrospective", "2026-08-25", "Review outcomes", "", ["Mayank"]); self.assertEqual(len(self.repo.list_meetings("Sprint")), 1)
    def test_add_and_complete_action(self):
        meeting = self.meeting(); action = self.repo.add_action(meeting["id"], "Prepare backlog", "Mayank", "2026-08-25", "High"); self.assertFalse(action["completed"]); self.assertTrue(self.repo.update_action(action["id"], True)["completed"])
    def test_stats(self):
        meeting = self.meeting(); self.repo.add_action(meeting["id"], "Future task", "Asha", (date.today() + timedelta(days=2)).isoformat(), "Low"); self.repo.add_action(meeting["id"], "Old task", "Mayank", (date.today() - timedelta(days=2)).isoformat(), "High"); stats = self.repo.stats(); self.assertEqual(stats["meetings"], 1); self.assertEqual(stats["open"], 2); self.assertEqual(stats["overdue"], 1)
    def test_delete_cascades_actions(self):
        meeting = self.meeting(); self.repo.add_action(meeting["id"], "Prepare notes", "Mayank", "2026-08-25", "Medium"); self.repo.delete_meeting(meeting["id"]); self.assertEqual(self.repo.stats()["actions"], 0)
    def test_missing_records_raise_friendly_errors(self):
        with self.assertRaisesRegex(RepositoryError, "meeting not found"): self.repo.get_meeting(999)
        with self.assertRaisesRegex(RepositoryError, "action item not found"): self.repo.update_action(999, True)
    def test_sql_injection_search_is_data(self):
        self.meeting(); self.assertEqual(self.repo.list_meetings("%' OR 1=1 --"), [])

if __name__ == "__main__": unittest.main()

