import json
import tempfile
import unittest
from pathlib import Path
from integritymap.core import IntegrityError, create_manifest, hash_file, load_manifest, verify_manifest

class IntegrityMapTests(unittest.TestCase):
    def setUp(self): self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name) / "files"; self.root.mkdir(); (self.root / "a.txt").write_text("alpha", encoding="utf-8"); (self.root / "nested").mkdir(); (self.root / "nested/b.txt").write_text("beta", encoding="utf-8"); self.manifest = Path(self.temp.name) / "manifest.json"
    def tearDown(self): self.temp.cleanup()
    def test_create_and_clean_verify(self):
        data = create_manifest(self.root, self.manifest); self.assertEqual(list(data["files"]), ["a.txt", "nested/b.txt"]); self.assertTrue(verify_manifest(self.root, self.manifest)["clean"])
    def test_detects_modified_file(self):
        create_manifest(self.root, self.manifest); (self.root / "a.txt").write_text("changed", encoding="utf-8"); self.assertEqual(verify_manifest(self.root, self.manifest)["modified"], ["a.txt"])
    def test_detects_missing_and_unexpected(self):
        create_manifest(self.root, self.manifest); (self.root / "a.txt").unlink(); (self.root / "new.txt").write_text("new", encoding="utf-8"); report = verify_manifest(self.root, self.manifest); self.assertEqual(report["missing"], ["a.txt"]); self.assertEqual(report["unexpected"], ["new.txt"])
    def test_ignore_globs_are_reused_during_verify(self):
        (self.root / "cache.tmp").write_text("one", encoding="utf-8"); create_manifest(self.root, self.manifest, ["*.tmp"]); (self.root / "cache.tmp").write_text("two", encoding="utf-8"); self.assertTrue(verify_manifest(self.root, self.manifest)["clean"])
    def test_hash_matches_known_sha256(self): self.assertEqual(hash_file(self.root / "a.txt"), "8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8")
    def test_rejects_bad_manifest_and_unsafe_path(self):
        self.manifest.write_text("{}", encoding="utf-8");
        with self.assertRaisesRegex(IntegrityError, "unsupported"): load_manifest(self.manifest)
        self.manifest.write_text(json.dumps({"version":1,"algorithm":"sha256","ignore":[],"files":{"../secret":{"size":1,"sha256":"a"*64}}}), encoding="utf-8")
        with self.assertRaisesRegex(IntegrityError, "invalid file entry"): load_manifest(self.manifest)
    def test_missing_root_is_friendly_error(self):
        with self.assertRaisesRegex(IntegrityError, "does not exist"): create_manifest(self.root / "missing", self.manifest)

if __name__ == "__main__": unittest.main()

