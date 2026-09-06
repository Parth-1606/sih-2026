"""
API integration tests for /api/investigations endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c



def test_post_investigation_success(client):
    # Use the seeded severe SST anomaly
    flagged = client.get("/api/anomalies").json()
    assert len(flagged) > 0
    target_anomaly = flagged[0]

    response = client.post(
        "/api/investigations",
        json={"anomaly_id": target_anomaly["id"]},
    )
    assert response.status_code == 201
    data = response.json()

    assert "id" in data
    assert data["anomaly_id"] == target_anomaly["id"]
    assert data["status"] in ("confirmed", "under_review", "needs_investigation")
    assert "agent_results" in data
    assert len(data["agent_results"]) == 3
    assert "synthesis" in data
    assert data["synthesis"]["synthesis_status"] == "confirmed_anomaly"
    assert data["confidence"] > 0.5


def test_post_investigation_anomaly_not_found(client):
    response = client.post(
        "/api/investigations",
        json={"anomaly_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_post_investigation_invalid_body(client):
    # Missing anomaly_id
    response = client.post(
        "/api/investigations",
        json={},
    )
    assert response.status_code == 422


def test_list_investigations_and_filter(client):
    flagged = client.get("/api/anomalies").json()
    target_id = flagged[0]["id"]

    # Trigger investigation
    post_res = client.post("/api/investigations", json={"anomaly_id": target_id})
    assert post_res.status_code == 201
    created_id = post_res.json()["id"]

    # List all
    list_res = client.get("/api/investigations")
    assert list_res.status_code == 200
    inv_list = list_res.json()
    assert any(i["id"] == created_id for i in inv_list)

    # Filter by anomaly_id
    filter_res = client.get(f"/api/investigations?anomaly_id={target_id}")
    assert filter_res.status_code == 200
    filtered_list = filter_res.json()
    assert all(i["anomaly_id"] == target_id for i in filtered_list)


def test_get_investigation_by_id(client):
    flagged = client.get("/api/anomalies").json()
    target_id = flagged[0]["id"]

    post_res = client.post("/api/investigations", json={"anomaly_id": target_id})
    assert post_res.status_code == 201
    inv_id = post_res.json()["id"]

    # Fetch by ID
    get_res = client.get(f"/api/investigations/{inv_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == inv_id

    # 404 for non-existent ID
    bad_res = client.get("/api/investigations/non-existent-inv-id")
    assert bad_res.status_code == 404
