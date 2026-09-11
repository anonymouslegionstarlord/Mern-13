from __future__ import annotations
import fnmatch
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

class IntegrityError(ValueError): pass

def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""): digest.update(chunk)
    except OSError as error: raise IntegrityError(f"cannot read {path}: {error}") from error
    return digest.hexdigest()

def valid_root(root: str | Path) -> Path:
    path = Path(root)
    if not path.exists(): raise IntegrityError("root directory does not exist")
    if not path.is_dir(): raise IntegrityError("root must be a directory")
    return path.resolve()

def scan(root: str | Path, ignores: list[str] | None = None, excluded: Path | None = None) -> dict[str, dict[str, Any]]:
    base = valid_root(root); patterns = ignores or []; entries = {}
    for path in sorted(base.rglob("*")):
        if path.is_symlink() or not path.is_file(): continue
        try: relative = path.relative_to(base).as_posix()
        except ValueError: continue
        if excluded and path.resolve() == excluded.resolve(): continue
        if any(fnmatch.fnmatch(relative, pattern) or fnmatch.fnmatch(path.name, pattern) for pattern in patterns): continue
        entries[relative] = {"size": path.stat().st_size, "sha256": hash_file(path)}
    return entries

def create_manifest(root: str | Path, manifest_path: str | Path, ignores: list[str] | None = None) -> dict[str, Any]:
    output = Path(manifest_path); data = {"version": 1, "algorithm": "sha256", "created_at": datetime.now(timezone.utc).isoformat(), "ignore": ignores or [], "files": scan(root, ignores, output)}
    try: output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    except OSError as error: raise IntegrityError(f"cannot write manifest: {error}") from error
    return data

def load_manifest(path: str | Path) -> dict[str, Any]:
    try: data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error: raise IntegrityError(f"cannot read manifest: {error}") from error
    if not isinstance(data, dict) or data.get("version") != 1 or data.get("algorithm") != "sha256" or not isinstance(data.get("files"), dict) or not isinstance(data.get("ignore", []), list): raise IntegrityError("manifest has an unsupported or invalid structure")
    for relative, entry in data["files"].items():
        pure = PurePosixPath(relative)
        if not relative or pure.is_absolute() or ".." in pure.parts or not isinstance(entry, dict) or not isinstance(entry.get("size"), int) or not isinstance(entry.get("sha256"), str) or len(entry["sha256"]) != 64: raise IntegrityError("manifest contains an invalid file entry")
    return data

def verify_manifest(root: str | Path, manifest_path: str | Path) -> dict[str, Any]:
    manifest = load_manifest(manifest_path); expected = manifest["files"]; current = scan(root, manifest.get("ignore", []), Path(manifest_path)); expected_paths, current_paths = set(expected), set(current)
    missing = sorted(expected_paths - current_paths); unexpected = sorted(current_paths - expected_paths); modified = sorted(path for path in expected_paths & current_paths if expected[path] != current[path])
    return {"clean": not (missing or modified or unexpected), "checked": len(expected_paths), "missing": missing, "modified": modified, "unexpected": unexpected}

