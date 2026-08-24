from __future__ import annotations
import json
import sqlite3
from pathlib import Path
from typing import Any

class RepositoryError(ValueError): pass

class Repository:
    def __init__(self, path: str | Path): self.path = str(path); self.initialize()
    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path); connection.row_factory = sqlite3.Row; connection.execute("PRAGMA foreign_keys = ON"); return connection
    def initialize(self) -> None:
        with self.connect() as db:
            db.executescript("""
            CREATE TABLE IF NOT EXISTS meetings (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, meeting_date TEXT NOT NULL, agenda TEXT NOT NULL, notes TEXT NOT NULL, attendees TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS actions (id INTEGER PRIMARY KEY AUTOINCREMENT, meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE, task TEXT NOT NULL, owner TEXT NOT NULL, due_date TEXT NOT NULL, priority TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
            """)
    @staticmethod
    def meeting(row: sqlite3.Row, actions: list[dict] | None = None) -> dict[str, Any]:
        item = dict(row); item["attendees"] = json.loads(item["attendees"]); item["actions"] = actions or []; return item
    @staticmethod
    def action(row: sqlite3.Row) -> dict[str, Any]:
        item = dict(row); item["completed"] = bool(item["completed"]); return item
    def create_meeting(self, title: str, meeting_date: str, agenda: str, notes: str, attendees: list[str]) -> dict:
        with self.connect() as db:
            cursor = db.execute("INSERT INTO meetings(title,meeting_date,agenda,notes,attendees) VALUES(?,?,?,?,?)", (title, meeting_date, agenda, notes, json.dumps(attendees))); meeting_id = cursor.lastrowid
        return self.get_meeting(meeting_id)
    def list_meetings(self, search: str = "") -> list[dict]:
        with self.connect() as db:
            if search: rows = db.execute("SELECT * FROM meetings WHERE title LIKE ? OR agenda LIKE ? ORDER BY meeting_date DESC,id DESC LIMIT 200", (f"%{search}%", f"%{search}%")).fetchall()
            else: rows = db.execute("SELECT * FROM meetings ORDER BY meeting_date DESC,id DESC LIMIT 200").fetchall()
        return [self.meeting(row) for row in rows]
    def get_meeting(self, meeting_id: int) -> dict:
        with self.connect() as db:
            row = db.execute("SELECT * FROM meetings WHERE id=?", (meeting_id,)).fetchone()
            if not row: raise RepositoryError("meeting not found")
            actions = [self.action(item) for item in db.execute("SELECT * FROM actions WHERE meeting_id=? ORDER BY completed, due_date, id", (meeting_id,)).fetchall()]
        return self.meeting(row, actions)
    def delete_meeting(self, meeting_id: int) -> None:
        with self.connect() as db:
            cursor = db.execute("DELETE FROM meetings WHERE id=?", (meeting_id,))
            if not cursor.rowcount: raise RepositoryError("meeting not found")
    def add_action(self, meeting_id: int, task: str, owner: str, due_date: str, priority: str) -> dict:
        with self.connect() as db:
            if not db.execute("SELECT 1 FROM meetings WHERE id=?", (meeting_id,)).fetchone(): raise RepositoryError("meeting not found")
            cursor = db.execute("INSERT INTO actions(meeting_id,task,owner,due_date,priority) VALUES(?,?,?,?,?)", (meeting_id, task, owner, due_date, priority)); row = db.execute("SELECT * FROM actions WHERE id=?", (cursor.lastrowid,)).fetchone()
        return self.action(row)
    def update_action(self, action_id: int, completed: bool) -> dict:
        with self.connect() as db:
            cursor = db.execute("UPDATE actions SET completed=? WHERE id=?", (int(completed), action_id))
            if not cursor.rowcount: raise RepositoryError("action item not found")
            row = db.execute("SELECT * FROM actions WHERE id=?", (action_id,)).fetchone()
        return self.action(row)
    def stats(self) -> dict[str, int]:
        with self.connect() as db:
            meetings = db.execute("SELECT COUNT(*) FROM meetings").fetchone()[0]; total = db.execute("SELECT COUNT(*) FROM actions").fetchone()[0]; completed = db.execute("SELECT COUNT(*) FROM actions WHERE completed=1").fetchone()[0]; overdue = db.execute("SELECT COUNT(*) FROM actions WHERE completed=0 AND due_date < date('now')").fetchone()[0]
        return {"meetings": meetings, "actions": total, "completed": completed, "open": total - completed, "overdue": overdue}

