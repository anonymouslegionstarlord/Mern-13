import os
from datetime import date
from fastapi import FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator
from .repository import Repository, RepositoryError

app = FastAPI(title="MinuteMate API", version="1.0.0", description="Meeting minutes and action-item tracking with SQLite.")
repo = Repository(os.getenv("MINUTEMATE_DB", "minutes.db")); priorities = {"Low", "Medium", "High"}

class MeetingCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120); meeting_date: date; agenda: str = Field(min_length=3, max_length=1000); notes: str = Field(default="", max_length=5000); attendees: list[str] = Field(min_length=1, max_length=30)
    @field_validator("title", "agenda")
    @classmethod
    def strip_required(cls, value: str) -> str:
        value = value.strip()
        if not value: raise ValueError("must not be blank")
        return value
    @field_validator("attendees")
    @classmethod
    def attendees_valid(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values if value.strip()]
        if not cleaned or any(len(value) > 80 for value in cleaned): raise ValueError("attendees must contain names up to 80 characters")
        if len({value.casefold() for value in cleaned}) != len(cleaned): raise ValueError("attendees must be unique")
        return cleaned

class ActionCreate(BaseModel):
    task: str = Field(min_length=3, max_length=300); owner: str = Field(min_length=2, max_length=80); due_date: date; priority: str = "Medium"
    @field_validator("task", "owner")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value: raise ValueError("must not be blank")
        return value
    @field_validator("priority")
    @classmethod
    def priority_valid(cls, value: str) -> str:
        if value not in priorities: raise ValueError("priority must be Low, Medium, or High")
        return value

class ActionUpdate(BaseModel): completed: bool
def missing(error: RepositoryError) -> HTTPException: return HTTPException(status_code=404, detail=str(error))

@app.get("/api/health")
def health(): return {"status": "ok"}
@app.get("/api/stats")
def stats(): return repo.stats()
@app.get("/api/meetings")
def list_meetings(search: str = Query("", max_length=100)): return repo.list_meetings(search.strip())
@app.post("/api/meetings", status_code=201)
def create_meeting(body: MeetingCreate): return repo.create_meeting(body.title, body.meeting_date.isoformat(), body.agenda, body.notes.strip(), body.attendees)
@app.get("/api/meetings/{meeting_id}")
def get_meeting(meeting_id: int):
    try: return repo.get_meeting(meeting_id)
    except RepositoryError as error: raise missing(error) from error
@app.delete("/api/meetings/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: int):
    try: repo.delete_meeting(meeting_id); return Response(status_code=204)
    except RepositoryError as error: raise missing(error) from error
@app.post("/api/meetings/{meeting_id}/actions", status_code=201)
def add_action(meeting_id: int, body: ActionCreate):
    try: return repo.add_action(meeting_id, body.task.strip(), body.owner.strip(), body.due_date.isoformat(), body.priority)
    except RepositoryError as error: raise missing(error) from error
@app.patch("/api/actions/{action_id}")
def update_action(action_id: int, body: ActionUpdate):
    try: return repo.update_action(action_id, body.completed)
    except RepositoryError as error: raise missing(error) from error
