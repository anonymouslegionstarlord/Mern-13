import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Response, status

from .database import SnippetStore
from .schemas import SnippetCreate, SnippetPublic, SnippetUpdate


def create_app(database_path: str | Path | None = None) -> FastAPI:
    store = SnippetStore(database_path or os.getenv("SNIPPET_DB_PATH", "snippets.db"))

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        store.initialize()
        yield

    application = FastAPI(
        title="SnippetShelf API",
        description="Store and search reusable code snippets.",
        version="1.0.0",
        lifespan=lifespan,
    )

    @application.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/api/snippets", response_model=list[SnippetPublic])
    def list_snippets(
        q: str | None = Query(default=None, max_length=100),
        language: str | None = Query(default=None, max_length=30),
        tag: str | None = Query(default=None, max_length=30),
    ):
        return store.list(q, language, tag)

    @application.post("/api/snippets", response_model=SnippetPublic, status_code=status.HTTP_201_CREATED)
    def create_snippet(payload: SnippetCreate):
        return store.create(payload.model_dump())

    @application.get("/api/snippets/{snippet_id}", response_model=SnippetPublic)
    def get_snippet(snippet_id: int):
        snippet = store.get(snippet_id)
        if not snippet:
            raise HTTPException(status_code=404, detail="Snippet not found")
        return snippet

    @application.patch("/api/snippets/{snippet_id}", response_model=SnippetPublic)
    def update_snippet(snippet_id: int, payload: SnippetUpdate):
        changes = payload.model_dump(exclude_unset=True)
        if not changes:
            raise HTTPException(status_code=400, detail="Provide at least one field to update")
        snippet = store.update(snippet_id, changes)
        if not snippet:
            raise HTTPException(status_code=404, detail="Snippet not found")
        return snippet

    @application.delete("/api/snippets/{snippet_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_snippet(snippet_id: int):
        if not store.delete(snippet_id):
            raise HTTPException(status_code=404, detail="Snippet not found")
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return application


app = create_app()

