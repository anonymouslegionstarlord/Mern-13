# MinuteMate API

MinuteMate is a beginner-friendly FastAPI service for storing meeting minutes and tracking action items with SQLite.

## Features

- Create, list, retrieve, and delete meeting records
- Store agenda, notes, meeting date, and attendees
- Add action items with owner, due date, priority, and completion status
- Update action-item workflow and view summary statistics
- SQLite parameterized queries and foreign-key cleanup
- Pydantic request validation, consistent HTTP errors, Swagger docs, and repository tests

## Setup

Python 3.11 or newer:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs`. The app creates `minutes.db` in the project directory. Set `MINUTEMATE_DB` in your shell only if you want another database path; no secrets are required.

## Main endpoints

- `GET/POST /api/meetings`
- `GET/DELETE /api/meetings/{meeting_id}`
- `POST /api/meetings/{meeting_id}/actions`
- `PATCH /api/actions/{action_id}`
- `GET /api/stats`

## Tests

```bash
python -m unittest discover -s tests -v
```

