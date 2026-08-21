# SnippetShelf

A beginner-friendly FastAPI service for storing, searching, tagging, and updating reusable code snippets. It uses SQLite from Python's standard library, so no database server is required.

## Features

- CRUD endpoints for code snippets
- Search by title, language, code, or description
- Filter by language and tag
- Pydantic request validation and safe response models
- SQLite persistence with parameterized queries
- FastAPI-generated Swagger UI at `/docs`
- Isolated API tests using a temporary database

## Setup

Python 3.11 or newer is recommended.

```bash
python -m venv .venv
```

Activate it on Windows:

```bash
.venv\Scripts\activate
```

Install and run:

```bash
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

On macOS/Linux, use `source .venv/bin/activate` and `cp .env.example .env`.

Open `http://127.0.0.1:8000/docs` to try the API.

## Tests

```bash
pytest -q
```

## Main endpoints

- `GET /api/snippets?q=fetch&language=javascript&tag=api`
- `POST /api/snippets`
- `GET /api/snippets/{id}`
- `PATCH /api/snippets/{id}`
- `DELETE /api/snippets/{id}`

