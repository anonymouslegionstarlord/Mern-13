from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app


def make_client(tmp_path: Path) -> TestClient:
    return TestClient(create_app(tmp_path / "test.db"))


def sample_payload() -> dict:
    return {
        "title": "Fetch JSON",
        "language": "Python",
        "code": "response = requests.get(url).json()",
        "description": "Read a JSON API response",
        "tags": ["api", "http"],
    }


def test_create_and_read_snippet(tmp_path: Path):
    with make_client(tmp_path) as client:
        created = client.post("/api/snippets", json=sample_payload())
        assert created.status_code == 201
        snippet_id = created.json()["id"]
        fetched = client.get(f"/api/snippets/{snippet_id}")
        assert fetched.status_code == 200
        assert fetched.json()["title"] == "Fetch JSON"


def test_search_and_tag_filter(tmp_path: Path):
    with make_client(tmp_path) as client:
        client.post("/api/snippets", json=sample_payload())
        response = client.get("/api/snippets", params={"q": "JSON", "tag": "API"})
        assert response.status_code == 200
        assert len(response.json()) == 1


def test_validation_rejects_blank_code(tmp_path: Path):
    with make_client(tmp_path) as client:
        payload = sample_payload() | {"code": "   "}
        response = client.post("/api/snippets", json=payload)
        assert response.status_code == 422


def test_update_and_delete(tmp_path: Path):
    with make_client(tmp_path) as client:
        snippet_id = client.post("/api/snippets", json=sample_payload()).json()["id"]
        updated = client.patch(f"/api/snippets/{snippet_id}", json={"title": "Fetch API JSON"})
        assert updated.status_code == 200
        assert updated.json()["title"] == "Fetch API JSON"
        deleted = client.delete(f"/api/snippets/{snippet_id}")
        assert deleted.status_code == 204
        assert client.get(f"/api/snippets/{snippet_id}").status_code == 404

