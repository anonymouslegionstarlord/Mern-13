import json
import sqlite3
from pathlib import Path
from typing import Any


SCHEMA = """
CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""


class SnippetStore:
    def __init__(self, database_path: str | Path):
        self.database_path = str(database_path)

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.execute(SCHEMA)

    @staticmethod
    def serialize(row: sqlite3.Row) -> dict[str, Any]:
        item = dict(row)
        item["tags"] = json.loads(item["tags"])
        return item

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        with self.connect() as connection:
            cursor = connection.execute(
                "INSERT INTO snippets (title, language, code, description, tags) VALUES (?, ?, ?, ?, ?)",
                (data["title"], data["language"], data["code"], data.get("description", ""), json.dumps(data.get("tags", []))),
            )
            row = connection.execute("SELECT * FROM snippets WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return self.serialize(row)

    def list(self, query: str | None, language: str | None, tag: str | None) -> list[dict[str, Any]]:
        clauses: list[str] = []
        values: list[str] = []
        if query:
            clauses.append("(title LIKE ? OR code LIKE ? OR description LIKE ?)")
            pattern = f"%{query}%"
            values.extend([pattern, pattern, pattern])
        if language:
            clauses.append("LOWER(language) = LOWER(?)")
            values.append(language)
        sql = "SELECT * FROM snippets" + (" WHERE " + " AND ".join(clauses) if clauses else "") + " ORDER BY updated_at DESC, id DESC"
        with self.connect() as connection:
            items = [self.serialize(row) for row in connection.execute(sql, values).fetchall()]
        if tag:
            needle = tag.casefold()
            items = [item for item in items if any(value.casefold() == needle for value in item["tags"])]
        return items

    def get(self, snippet_id: int) -> dict[str, Any] | None:
        with self.connect() as connection:
            row = connection.execute("SELECT * FROM snippets WHERE id = ?", (snippet_id,)).fetchone()
        return self.serialize(row) if row else None

    def update(self, snippet_id: int, data: dict[str, Any]) -> dict[str, Any] | None:
        existing = self.get(snippet_id)
        if not existing:
            return None
        merged = {**existing, **data}
        with self.connect() as connection:
            connection.execute(
                "UPDATE snippets SET title = ?, language = ?, code = ?, description = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (merged["title"], merged["language"], merged["code"], merged["description"], json.dumps(merged["tags"]), snippet_id),
            )
        return self.get(snippet_id)

    def delete(self, snippet_id: int) -> bool:
        with self.connect() as connection:
            cursor = connection.execute("DELETE FROM snippets WHERE id = ?", (snippet_id,))
        return cursor.rowcount > 0

