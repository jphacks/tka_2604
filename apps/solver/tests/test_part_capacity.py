import pytest
from pydantic import ValidationError

from solver import solve_request
from solver_input import SolveRequest


def request(counts: list[int], bands: int) -> SolveRequest:
    return SolveRequest.model_validate(
        {
            "eventId": "live",
            "parts": [
                {"partId": f"p{i}", "sortOrder": i, "bandCount": count}
                for i, count in enumerate(counts)
            ],
            "bands": [{"bandId": f"b{i}"} for i in range(bands)],
            "members": [],
            "memberships": [],
            "constraints": [],
            "currentPlacements": [],
        }
    )


@pytest.mark.parametrize(
    "counts,bands", [([2, 3], 5), ([2, 3], 3), ([1, 2], 5), ([0, 2], 3), ([0, 2], 2)]
)
def test_solver_respects_configured_part_counts(counts: list[int], bands: int):
    result = solve_request(request(counts, bands))
    assert result.status in ("optimal", "feasible", "partial")
    assert result.placements is not None
    assert len(result.placements) == min(sum(counts), bands)
    for i, count in enumerate(counts):
        actual = sum(item.partId == f"p{i}" for item in result.placements)
        assert actual <= count
        if bands >= sum(counts):
            assert actual == count
    ids = [item.bandId for item in result.placements] + result.unassignedBandIds
    assert len(ids) == len(set(ids)) == bands


@pytest.mark.parametrize("count", [-1, 1.5, True])
def test_invalid_part_count_is_rejected(count):
    with pytest.raises(ValidationError):
        request([count], 2)


def test_zero_total_capacity_returns_no_placement():
    result = solve_request(request([0, 0], 2))
    assert result.status == "infeasible"
    assert result.placements is None
    assert result.unassignedBandIds is None
