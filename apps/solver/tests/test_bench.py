import json
from pathlib import Path

import pytest

from evaluate import evaluate
from generate import CASE_NAMES, build_cases
from measure import measure_case
from generated.constraint import Constraint

CASES_DIR = Path(__file__).parents[1] / "bench" / "cases"


def constraint(constraint_id, type_, targets, params, hardness="hard", enabled=True):
    return {
        "schema_version": "1.0.0",
        "constraint_id": constraint_id,
        "event_id": "event-1",
        "type": type_,
        "hardness": hardness,
        "priority": None if hardness == "hard" else "mid",
        "enabled": enabled,
        "targets": targets,
        "params": params,
    }


def request(constraints):
    """設計書の例と同じ4バンド・2部。m1はA・C、m2はB・Dに所属する。"""
    return {
        "eventId": "event-1",
        "parts": [
            {"partId": "part-1", "sortOrder": 0},
            {"partId": "part-2", "sortOrder": 1},
        ],
        "bands": [{"bandId": f"band-{b}"} for b in "abcd"],
        "members": [{"memberId": "m1"}, {"memberId": "m2"}],
        "memberships": [
            {"bandId": "band-a", "memberId": "m1"},
            {"bandId": "band-c", "memberId": "m1"},
            {"bandId": "band-b", "memberId": "m2"},
            {"bandId": "band-d", "memberId": "m2"},
        ],
        "constraints": constraints,
        "currentPlacements": [],
    }


def placed(*parts, status="optimal", unassigned=(), results=None):
    placements = [
        {"bandId": f"band-{b}", "partId": f"part-{p + 1}", "order": i}
        for p, bands in enumerate(parts)
        for i, b in enumerate(bands)
    ]
    response = {
        "eventId": "event-1",
        "status": status,
        "placements": placements,
        "unassignedBandIds": [f"band-{b}" for b in unassigned],
    }
    if results is not None:
        response["constraintResults"] = [
            {"constraintId": k, "status": v} for k, v in results.items()
        ]
    return response


GAP_M1 = constraint(
    "gap-m1", "min_gap_member", {"member_id": "m1"}, {"min_diff": 2, "same_part_only": False}
)


def test_full_placement_meets_constraints() -> None:
    report = evaluate(request([GAP_M1]), placed("ab", "cd"))

    assert report.integrity_errors == []
    assert report.results == {"gap-m1": "met"}
    assert report.hard_violations == []


def test_part_boundary_does_not_add_gap() -> None:
    # 全体位置はA=0, C=1。部をまたいでも隣接なので違反になる。
    report = evaluate(request([GAP_M1]), placed("ba", "cd"))

    assert report.hard_violations == ["gap-m1"]


def test_same_part_only_ignores_pairs_across_parts() -> None:
    gap = constraint(
        "gap", "min_gap_member", {"member_id": "m1"}, {"min_diff": 2, "same_part_only": True}
    )

    assert evaluate(request([gap]), placed("ba", "cd")).results == {"gap": "met"}


def test_soft_violation_is_unmet_and_disabled_is_skipped() -> None:
    soft = constraint(
        "before", "before", {"before_band_id": "band-d", "after_band_id": "band-a"}, {}, "soft"
    )
    off = constraint("pos", "at_position", {"band_id": "band-d"}, {"position": 0}, enabled=False)

    report = evaluate(request([soft, off]), placed("ab", "cd"))

    assert report.results == {"before": "unmet", "pos": "disabled"}
    assert report.hard_violations == []
    assert (report.soft_met, report.soft_total) == (0, 1)


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"scope": "per_part", "min": 2, "max": 2}, "met"),
        ({"scope": "per_part", "min": 0, "max": 1}, "violated"),
        ({"scope": "in_parts", "part_ids": [1], "min": 3, "max": 4}, "violated"),
    ],
)
def test_count(params, expected) -> None:
    count = constraint("count", "count", {"band_ids": [f"band-{b}" for b in "abcd"]}, params)

    assert evaluate(request([count]), placed("ab", "cd")).results == {"count": expected}


def test_in_range_by_positions_and_parts() -> None:
    by_position = constraint(
        "pos",
        "in_range",
        {"band_ids": ["band-c"]},
        {"kind": "positions", "position_from": 1, "position_to": 2},
    )
    by_part = constraint("part", "in_range", {"band_ids": ["band-c"]}, {"kind": "parts", "part_ids": [0]})

    assert evaluate(request([by_position, by_part]), placed("ab", "cd")).results == {
        "pos": "met",
        "part": "violated",
    }


def test_partial_marks_unplaced_targets_unchecked_but_keeps_visible_violations() -> None:
    gap_m2 = constraint(
        "gap-m2", "min_gap_member", {"member_id": "m2"}, {"min_diff": 2, "same_part_only": False}
    )
    cap = constraint(
        "cap", "count", {"band_ids": [f"band-{b}" for b in "abcd"]}, {"scope": "per_part", "min": 0, "max": 1}
    )
    response = placed("a", "c", status="partial", unassigned="bd")

    report = evaluate(request([GAP_M1, gap_m2, cap]), response)

    assert report.integrity_errors == []
    # A=0, C=1で隣接。Cが配置済みなので判定できる違反として扱う。
    assert report.results == {"gap-m1": "violated", "gap-m2": "unchecked", "cap": "unchecked"}


def test_integrity_errors() -> None:
    duplicated = placed("ab", "ca")
    gap_in_order = placed("ab", "cd")
    gap_in_order["placements"][3]["order"] = 5
    partial_without_unassigned = placed("ab", "cd", status="partial")

    assert any("band-a" in e for e in evaluate(request([]), duplicated).integrity_errors)
    assert evaluate(request([]), gap_in_order).integrity_errors
    assert evaluate(request([]), partial_without_unassigned).integrity_errors


def test_no_placement_statuses_must_be_null() -> None:
    empty = {"eventId": "event-1", "status": "unknown", "placements": None,
             "unassignedBandIds": None, "constraintResults": None}
    leaked = {**empty, "placements": []}

    assert evaluate(request([GAP_M1]), empty).integrity_errors == []
    assert evaluate(request([GAP_M1]), leaked).integrity_errors


def test_reports_mismatch_with_returned_results() -> None:
    response = placed("ab", "cd", results={"gap-m1": "unmet"})

    assert evaluate(request([GAP_M1]), response).mismatches == ["gap-m1: solver=unmet, expected=met"]


@pytest.mark.parametrize("name", CASE_NAMES)
def test_committed_cases_match_generator(name) -> None:
    case = build_cases()[name]

    for kind in ("request", "expected"):
        committed = json.loads((CASES_DIR / f"{name}.{kind}.json").read_text())
        assert committed == case[kind], f"{name}.{kind}.json が古い。generate.pyを再実行する"


@pytest.mark.parametrize("name", CASE_NAMES)
def test_case_constraints_follow_schema(name) -> None:
    for c in build_cases()[name]["request"]["constraints"]:
        Constraint.model_validate(c)


@pytest.mark.parametrize("name", CASE_NAMES)
def test_reference_placement_matches_expected_results(name) -> None:
    case = build_cases()[name]
    expected = case["expected"]

    report = evaluate(case["request"], expected["reference"])

    assert report.integrity_errors == []
    assert report.hard_violations == []
    assert report.results == expected["referenceResults"]
    assert expected["reference"]["status"] in expected["allowedStatuses"]


def test_measure_flags_unexpected_status_and_http_errors() -> None:
    case = build_cases()["hard_conflict"]
    request, expected = case["request"], case["expected"]
    # 全配置不可のケースで全配置を返すのは誤り。
    wrong = {**build_cases()["standard"]["expected"]["reference"], "eventId": request["eventId"]}

    ok = measure_case("hard_conflict", request, expected, 200, expected["reference"], 1.0)
    bad = measure_case("hard_conflict", request, expected, 200, wrong, 1.0)
    error = measure_case("hard_conflict", request, expected, 422, {"error": {"code": "invalid_input"}}, 0.1)

    assert ok["ok"] and ok["hardViolations"] == 0 and ok["unassigned"] == 2
    assert not bad["ok"]
    assert not error["ok"] and error["status"] is None
