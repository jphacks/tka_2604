import pytest
from fastapi.testclient import TestClient

import main
from main import app
from solver_output import SolveResponse

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


def solve_payload(constraints: list[dict[str, object]] | None = None) -> dict[str, object]:
    return {
        "eventId": "event-1",
        "parts": [{"partId": "part-1", "sortOrder": 0}],
        "bands": [{"bandId": "band-a"}, {"bandId": "band-b"}],
        "members": [],
        "memberships": [],
        "constraints": constraints or [],
        "currentPlacements": [],
    }


def post_solve(client: TestClient, payload: dict[str, object]):
    return client.post(
        "/solve",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json=payload,
    )


def test_solve_accepts_real_http_request_and_returns_complete_placements(
    client: TestClient,
) -> None:
    response = post_solve(client, solve_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["eventId"] == "event-1"
    assert body["status"] in ("optimal", "feasible")
    assert {placement["bandId"] for placement in body["placements"]} == {
        "band-a",
        "band-b",
    }
    assert body["unassignedBandIds"] == []
    assert "diagnostics" not in body or body["diagnostics"] == []


def test_solve_accepts_band_count_for_each_part(client: TestClient) -> None:
    payload = solve_payload()
    payload["parts"] = [
        {"partId": "part-1", "sortOrder": 0, "bandCount": 5},
        {"partId": "part-2", "sortOrder": 1, "bandCount": 5},
    ]

    response = post_solve(client, payload)

    assert response.status_code == 200


def test_solve_respects_each_part_band_count_as_capacity(client: TestClient) -> None:
    payload = solve_payload()
    payload["parts"] = [
        {"partId": "part-1", "sortOrder": 0, "bandCount": 1},
        {"partId": "part-2", "sortOrder": 1, "bandCount": 1},
    ]

    response = post_solve(client, payload)

    assert response.status_code == 200
    placements = response.json()["placements"]
    assert [
        sum(placement["partId"] == part_id for placement in placements)
        for part_id in ("part-1", "part-2")
    ] == [1, 1]


def test_solve_rejects_band_counts_with_insufficient_total_capacity(
    client: TestClient,
) -> None:
    payload = solve_payload()
    payload["bands"].append({"bandId": "band-c"})
    payload["parts"] = [
        {"partId": "part-1", "sortOrder": 0, "bandCount": 1},
        {"partId": "part-2", "sortOrder": 1, "bandCount": 1},
    ]

    response = post_solve(client, payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"


def test_solve_rejects_partially_specified_band_counts(client: TestClient) -> None:
    payload = solve_payload()
    payload["parts"] = [
        {"partId": "part-1", "sortOrder": 0, "bandCount": 1},
        {"partId": "part-2", "sortOrder": 1},
    ]

    response = post_solve(client, payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"


@pytest.mark.parametrize("gap_type", ["min_gap_member", "min_gap_bands"])
def test_solve_ignores_min_gap_pairs_across_parts(
    client: TestClient, gap_type: str
) -> None:
    payload = solve_payload()
    payload["parts"] = [
        {"partId": "part-1", "sortOrder": 0, "bandCount": 1},
        {"partId": "part-2", "sortOrder": 1, "bandCount": 1},
    ]
    payload["constraints"] = [
        {
            "schema_version": "1.0.0",
            "constraint_id": "c-part-a",
            "event_id": "event-1",
            "type": "in_range",
            "hardness": "hard",
            "priority": None,
            "enabled": True,
            "targets": {"band_ids": ["band-a"]},
            "params": {"kind": "parts", "part_ids": [0]},
        },
        {
            "schema_version": "1.0.0",
            "constraint_id": "c-part-b",
            "event_id": "event-1",
            "type": "in_range",
            "hardness": "hard",
            "priority": None,
            "enabled": True,
            "targets": {"band_ids": ["band-b"]},
            "params": {"kind": "parts", "part_ids": [1]},
        },
        {
            "schema_version": "1.0.0",
            "constraint_id": "c-gap",
            "event_id": "event-1",
            "type": gap_type,
            "hardness": "hard",
            "priority": None,
            "enabled": True,
            "targets": (
                {"member_id": "member-1"}
                if gap_type == "min_gap_member"
                else {"band_ids": ["band-a", "band-b"]}
            ),
            "params": {"min_diff": 2, "same_part_only": True},
        },
    ]
    if gap_type == "min_gap_member":
        payload["members"] = [{"memberId": "member-1"}]
        payload["memberships"] = [
            {"bandId": "band-a", "memberId": "member-1"},
            {"bandId": "band-b", "memberId": "member-1"},
        ]

    response = post_solve(client, payload)

    assert response.status_code == 200
    body = response.json()
    placements = {item["bandId"]: item["partId"] for item in body["placements"]}
    assert placements == {"band-a": "part-1", "band-b": "part-2"}
    assert body["constraintResults"][-1] == {
        "constraintId": "c-gap",
        "status": "met",
    }


@pytest.mark.parametrize("band_count", [-1, 1.5, True, "5"])
def test_solve_rejects_invalid_part_band_count(
    client: TestClient, band_count: object
) -> None:
    payload = solve_payload()
    payload["parts"] = [
        {"partId": "part-1", "sortOrder": 0, "bandCount": band_count},
    ]

    response = post_solve(client, payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"


def test_solve_integrates_supported_constraint_types_and_parameter_branches(
    client: TestClient,
) -> None:
    payload = solve_payload(
        [
            {
                "schema_version": "1.0.0",
                "constraint_id": "c-position",
                "event_id": "event-1",
                "type": "at_position",
                "hardness": "hard",
                "priority": None,
                "enabled": True,
                "targets": {"band_id": "band-a"},
                "params": {"position": 0},
            },
            {
                "schema_version": "1.0.0",
                "constraint_id": "c-before",
                "event_id": "event-1",
                "type": "before",
                "hardness": "hard",
                "priority": None,
                "enabled": True,
                "targets": {"before_band_id": "band-a", "after_band_id": "band-b"},
                "params": {},
            },
            {
                "schema_version": "1.0.0",
                "constraint_id": "c-range-positions",
                "event_id": "event-1",
                "type": "in_range",
                "hardness": "hard",
                "priority": None,
                "enabled": True,
                "targets": {"band_ids": ["band-c"]},
                "params": {"kind": "positions", "position_from": 1, "position_to": 3},
            },
            {
                "schema_version": "1.0.0",
                "constraint_id": "c-range-parts",
                "event_id": "event-1",
                "type": "in_range",
                "hardness": "hard",
                "priority": None,
                "enabled": True,
                "targets": {"band_ids": ["band-d"]},
                "params": {"kind": "parts", "part_ids": [1]},
            },
            {
                "schema_version": "1.0.0",
                "constraint_id": "c-gap-member",
                "event_id": "event-1",
                "type": "min_gap_member",
                "hardness": "hard",
                "priority": None,
                "enabled": True,
                "targets": {"member_id": "member-1"},
                "params": {"min_diff": 2, "same_part_only": False},
            },
            {
                "schema_version": "1.0.0",
                "constraint_id": "c-gap-bands",
                "event_id": "event-1",
                "type": "min_gap_bands",
                "hardness": "hard",
                "priority": None,
                "enabled": True,
                "targets": {"band_ids": ["band-b", "band-c"]},
                "params": {"min_diff": 2, "same_part_only": True},
            },
            {
                "schema_version": "1.0.0",
                "constraint_id": "c-soft-position",
                "event_id": "event-1",
                "type": "at_position",
                "hardness": "soft",
                "priority": "mid",
                "enabled": True,
                "targets": {"band_id": "band-b"},
                "params": {"position": 0},
            },
        ]
    )
    payload["bands"] = [{"bandId": f"band-{name}"} for name in "abcd"]
    payload["parts"] = [
        {"partId": "part-1", "sortOrder": 0},
        {"partId": "part-2", "sortOrder": 1},
    ]
    payload["members"] = [{"memberId": "member-1"}]
    payload["memberships"] = [
        {"bandId": "band-b", "memberId": "member-1"},
        {"bandId": "band-c", "memberId": "member-1"},
    ]
    payload["currentPlacements"] = [
        {"bandId": "band-a", "partId": "part-1", "order": 1},
        {"bandId": "band-b", "partId": "part-1", "order": 0},
    ]

    response = post_solve(client, payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] in ("optimal", "feasible")
    assert {item["status"] for item in body["constraintResults"] if item["constraintId"] != "c-soft-position"} == {"met"}
    soft_status = next(
        item["status"]
        for item in body["constraintResults"]
        if item["constraintId"] == "c-soft-position"
    )
    assert soft_status == "unmet"


def test_solve_returns_partial_for_conflicting_hard_positions(client: TestClient) -> None:
    payload = solve_payload(
        [
            {
                "schema_version": "1.0.0",
                "constraint_id": "c-position-a",
                "event_id": "event-1",
                "type": "at_position",
                "hardness": "hard",
                "priority": None,
                "enabled": True,
                "targets": {"band_id": "band-a"},
                "params": {"position": 0},
            },
            {
                "schema_version": "1.0.0",
                "constraint_id": "c-position-b",
                "event_id": "event-1",
                "type": "at_position",
                "hardness": "hard",
                "priority": None,
                "enabled": True,
                "targets": {"band_id": "band-b"},
                "params": {"position": 0},
            },
        ]
    )

    response = post_solve(client, payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "partial"
    assert len(body["placements"]) == 1
    assert len(body["unassignedBandIds"]) == 1
    assert sorted(item["status"] for item in body["constraintResults"]) == [
        "met",
        "unchecked",
    ]


def test_solve_returns_contract_error_for_invalid_input(client: TestClient) -> None:
    payload = solve_payload()
    payload["memberships"] = [{"bandId": "missing", "memberId": "missing"}]

    response = post_solve(client, payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"
    assert response.json()["error"]["details"]


def test_solve_returns_infeasible_when_partial_search_cannot_place_a_band(
    client: TestClient,
) -> None:
    payload = solve_payload(
        [
            {
                "schema_version": "1.0.0",
                "constraint_id": f"c-position-{band_id}-{position}",
                "event_id": "event-1",
                "type": "at_position",
                "hardness": "hard",
                "priority": None,
                "enabled": True,
                "targets": {"band_id": band_id},
                "params": {"position": position},
            }
            for band_id in ("band-a", "band-b")
            for position in (0, 1)
        ]
    )

    response = post_solve(client, payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "infeasible"
    assert body["placements"] is None
    assert body["unassignedBandIds"] is None


def test_solve_serializes_unknown_status(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        main,
        "solve_request",
        lambda _request: SolveResponse(
            eventId="event-1",
            status="unknown",
            placements=None,
            unassignedBandIds=None,
            constraintResults=None,
        ),
    )

    response = post_solve(client, solve_payload())

    assert response.status_code == 200
    assert response.json()["status"] == "unknown"
    assert response.json()["placements"] is None


def test_solve_serializes_optional_diagnostics(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        main,
        "solve_request",
        lambda _request: SolveResponse(
            eventId="event-1",
            status="partial",
            placements=[{"bandId": "band-a", "partId": "part-1", "order": 0}],
            unassignedBandIds=["band-b"],
            constraintResults=[{"constraintId": "c-position", "status": "unchecked"}],
            diagnostics=[
                {
                    "code": "hard_constraints_conflict",
                    "constraintIds": ["c-position"],
                    "message": "診断例",
                }
            ],
        ),
    )

    payload = solve_payload(
        [
            {
                "schema_version": "1.0.0",
                "constraint_id": "c-position",
                "event_id": "event-1",
                "type": "at_position",
                "hardness": "hard",
                "priority": None,
                "enabled": True,
                "targets": {"band_id": "band-a"},
                "params": {"position": 0},
            }
        ]
    )

    response = post_solve(client, payload)

    assert response.status_code == 200
    assert response.json()["diagnostics"] == [
        {
            "code": "hard_constraints_conflict",
            "constraintIds": ["c-position"],
            "message": "診断例",
        }
    ]


def test_solve_converts_internal_exception_to_500(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(_request):
        raise RuntimeError("secret detail")

    monkeypatch.setattr(main, "solve_request", fail)

    response = post_solve(client, solve_payload())

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "solver_internal_error",
            "message": "ソルバー内部でエラーが発生しました",
            "details": [],
        }
    }
