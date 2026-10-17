"""Build and serialize the agreed Solver response contract."""

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from solver_input import CurrentPlacement, SolveRequest

SolveStatus = Literal["optimal", "feasible", "partial", "infeasible", "unknown"]
ConstraintStatus = Literal["met", "unmet", "disabled", "unchecked"]


class OutputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ConstraintResult(OutputModel):
    constraintId: str
    status: ConstraintStatus


class Diagnostic(OutputModel):
    code: str
    constraintIds: list[str]
    message: str


class SolveResponse(OutputModel):
    eventId: str
    status: SolveStatus
    placements: list[CurrentPlacement] | None
    unassignedBandIds: list[str] | None
    constraintResults: list[ConstraintResult] | None
    diagnostics: list[Diagnostic] = Field(default_factory=list)


class ErrorDetail(OutputModel):
    path: str
    reason: str


class ErrorPayload(OutputModel):
    code: Literal["invalid_input", "solver_internal_error"]
    message: str
    details: list[ErrorDetail]


class ErrorResponse(OutputModel):
    error: ErrorPayload


def build_response(
    request: SolveRequest,
    status: SolveStatus,
    placements: list[CurrentPlacement] | None = None,
    unassigned_band_ids: list[str] | None = None,
    constraint_results: list[ConstraintResult] | None = None,
    diagnostics: list[Diagnostic] | None = None,
) -> SolveResponse:
    """Reject results that would misstate the Solver's status or lose a band."""
    all_band_ids = {band.bandId for band in request.bands}
    part_ids = {part.partId for part in request.parts}
    response = SolveResponse(
        eventId=request.eventId,
        status=status,
        placements=placements,
        unassignedBandIds=unassigned_band_ids,
        constraintResults=constraint_results,
        diagnostics=diagnostics or [],
    )

    if status in ("infeasible", "unknown"):
        if any(
            value is not None
            for value in (placements, unassigned_band_ids, constraint_results)
        ):
            raise ValueError(f"{status}では配置と達成状況をnullにしてください")
    else:
        if not placements or unassigned_band_ids is None or constraint_results is None:
            raise ValueError(f"{status}では配置・未配置一覧・達成状況が必要です")
        placed_ids = [item.bandId for item in placements]
        if len(placed_ids) != len(set(placed_ids)):
            raise ValueError("placementsに同じバンドが複数あります")
        if len(unassigned_band_ids) != len(set(unassigned_band_ids)):
            raise ValueError("unassignedBandIdsに同じバンドが複数あります")
        if set(placed_ids) & set(unassigned_band_ids) or (
            set(placed_ids) | set(unassigned_band_ids) != all_band_ids
        ):
            raise ValueError("配置済みと未配置の和集合が入力バンドと一致しません")
        if status == "partial" and not unassigned_band_ids:
            raise ValueError("partialには未配置バンドが必要です")
        if status in ("optimal", "feasible") and unassigned_band_ids:
            raise ValueError("完全配置に未配置バンドは含められません")
        for part_id in part_ids:
            orders = [item.order for item in placements if item.partId == part_id]
            if sorted(orders) != list(range(len(orders))):
                raise ValueError(f"{part_id}のorderが0から連続していません")
        if any(item.partId not in part_ids for item in placements):
            raise ValueError("placementsに存在しないpartIdがあります")

        input_constraints = {
            item.root.constraint_id: item.root for item in request.constraints
        }
        result_ids = [item.constraintId for item in constraint_results]
        if len(result_ids) != len(set(result_ids)) or set(result_ids) != set(
            input_constraints
        ):
            raise ValueError("constraintResultsは入力制約ごとに1件必要です")
        for item in constraint_results:
            constraint = input_constraints[item.constraintId]
            if not constraint.enabled and item.status != "disabled":
                raise ValueError("無効制約の結果はdisabledにしてください")
            if constraint.enabled and item.status == "disabled":
                raise ValueError("有効制約をdisabledにできません")
            if constraint.hardness == "hard" and item.status == "unmet":
                raise ValueError("hard制約の違反を含む配置は返せません")
            if (
                status != "partial"
                and item.status == "unchecked"
                and constraint.type != "count"
            ):
                raise ValueError("完全配置の制約はuncheckedにできません")

    input_constraint_ids = {item.root.constraint_id for item in request.constraints}
    for item in response.diagnostics:
        if not set(item.constraintIds) <= input_constraint_ids:
            raise ValueError("diagnosticsに入力にないconstraintIdがあります")
    return response


def write_response(path: Path, response: SolveResponse | ErrorResponse) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    excluded = (
        {"diagnostics"}
        if isinstance(response, SolveResponse) and not response.diagnostics
        else None
    )
    path.write_text(
        response.model_dump_json(indent=2, exclude=excluded) + "\n",
        encoding="utf-8",
    )
