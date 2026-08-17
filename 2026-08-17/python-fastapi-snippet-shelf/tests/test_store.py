import tempfile
import unittest
from pathlib import Path

from app.database import SnippetStore


class SnippetStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = SnippetStore(Path(self.temp_dir.name) / "test.db")
        self.store.initialize()

    def tearDown(self):
        self.temp_dir.cleanup()

    def payload(self):
        return {
            "title": "Fetch JSON",
            "language": "Python",
            "code": "print('hello')",
            "description": "Example",
            "tags": ["api", "demo"],
        }

    def test_create_search_update_and_delete(self):
        created = self.store.create(self.payload())
        self.assertEqual(created["tags"], ["api", "demo"])
        self.assertEqual(len(self.store.list("JSON", "python", "API")), 1)

        updated = self.store.update(created["id"], {"title": "Updated snippet"})
        self.assertEqual(updated["title"], "Updated snippet")
        self.assertTrue(self.store.delete(created["id"]))
        self.assertIsNone(self.store.get(created["id"]))

    def test_missing_item_returns_none(self):
        self.assertIsNone(self.store.get(999))
        self.assertIsNone(self.store.update(999, {"title": "Missing"}))
        self.assertFalse(self.store.delete(999))


if __name__ == "__main__":
    unittest.main()
