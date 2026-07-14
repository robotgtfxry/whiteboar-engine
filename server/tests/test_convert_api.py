"""Testy endpointu POST /convert (warstwa HTTP).

TestClient bez menedżera kontekstu → lifespan (create_all/seed) się nie uruchamia,
więc `/convert` (nie dotyka bazy) działa bez połączenia z Postgresem. Auth nadpisujemy.
"""

import json
import uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.deps import get_current_user
from app.main import app

SCENE = {
    "type": "excalidraw",
    "version": 2,
    "elements": [
        {"id": "box", "type": "rectangle", "x": 0, "y": 0, "width": 100, "height": 50,
         "boundElements": [{"id": "t", "type": "text"}]},
        {"id": "t", "type": "text", "x": 5, "y": 5, "width": 90, "height": 20,
         "text": "Hej", "fontSize": 16, "containerId": "box"},
        {"id": "img", "type": "image", "x": 0, "y": 0, "width": 10, "height": 10, "fileId": "f1"},
    ],
}


def _upload(client, name, content):
    data = content if isinstance(content, (bytes, str)) else json.dumps(content)
    if isinstance(data, str):
        data = data.encode("utf-8")
    return client.post("/convert", files={"file": (name, data, "application/json")})


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id=uuid.uuid4(), is_admin=True
    )
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_requires_auth():
    # bez override → brak tokenu → 401
    resp = TestClient(app).post(
        "/convert", files={"file": ("s.excalidraw", b"{}", "application/json")}
    )
    assert resp.status_code == 401


def test_convert_returns_document_and_diagnostics(client):
    resp = _upload(client, "scene.excalidraw", SCENE)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["source"] == "excalidraw"
    assert body["fidelity"] == 1
    assert body["stats"]["nodes"] == 2
    assert body["stats"]["mergedLabels"] == 1
    assert body["stats"]["opaque"] == 1
    assert body["document"]["nodes"][0]["text"] == "Hej"
    assert any("opaque" in w for w in body["warnings"])


def test_invalid_json_returns_400(client):
    resp = _upload(client, "x.excalidraw", b"{nope")
    assert resp.status_code == 400
    assert "JSON" in resp.json()["detail"]


def test_dev_file_hints_correct_endpoint(client):
    resp = _upload(client, "x.json", json.dumps({"format": "whiteboard-engine/dev", "version": 1}))
    assert resp.status_code == 400
    assert ".devbrd" in resp.json()["detail"]


def test_routes_registered():
    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/convert" in paths
    assert "/boards/import-file" in paths
