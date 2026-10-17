import pytest
from fastapi.testclient import TestClient

from main import app

TOKEN = "test-token"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("SOLVER_API_TOKEN", TOKEN)
    return TestClient(app)


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_probe_solves_sample_with_cp_sat(client: TestClient) -> None:
    response = client.post("/probe", headers={"Authorization": f"Bearer {TOKEN}"})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "OPTIMAL"
    order = body["order"]
    assert sorted(order) == ["A", "B", "C"]
    assert order.index("A") < order.index("C")
    assert body["ortools_version"]
    assert body["solve_seconds"] >= 0


@pytest.mark.parametrize("header", [None, "Bearer wrong-token", TOKEN])
def test_probe_rejects_missing_or_wrong_token(
    client: TestClient, header: str | None
) -> None:
    headers = {"Authorization": header} if header else {}

    response = client.post("/probe", headers=headers)

    assert response.status_code == 401


def test_probe_refuses_when_token_is_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("SOLVER_API_TOKEN", raising=False)

    response = TestClient(app).post("/probe", headers={"Authorization": "Bearer "})

    assert response.status_code == 503
