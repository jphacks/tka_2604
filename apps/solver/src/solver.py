"""CP-SAT calculation for the BE-to-Solver contract."""

from dataclasses import dataclass
from itertools import combinations

from ortools.sat.python import cp_model

from solver_input import CurrentPlacement, SolveRequest
from solver_output import ConstraintResult, SolveResponse, build_response


@dataclass
class ModelVariables:
    model: cp_model.CpModel
    assignment: dict[tuple[int, int], cp_model.IntVar]
    present: dict[int, cp_model.IntVar]
    local_order: dict[int, cp_model.IntVar]
    global_position: dict[int, cp_model.IntVar]


def _build_model(request: SolveRequest, allow_partial: bool) -> ModelVariables:
    parts = sorted(request.parts, key=lambda part: part.sortOrder)
    bands = request.bands
    part_count = len(parts)
    band_count = len(bands)
    model = cp_model.CpModel()
    assignment = {
        (band_index, part_index): model.new_bool_var(
            f"assigned_{band_index}_{part_index}"
        )
        for band_index in range(band_count)
        for part_index in range(part_count)
    }
    present = {
        band_index: model.new_bool_var(f"present_{band_index}")
        for band_index in range(band_count)
    }
    local_order = {
        band_index: model.new_int_var(0, band_count - 1, f"order_{band_index}")
        for band_index in range(band_count)
    }
    global_position = {
        band_index: model.new_int_var(0, band_count - 1, f"position_{band_index}")
        for band_index in range(band_count)
    }
    part_sizes = {
        part_index: model.new_int_var(0, band_count, f"part_size_{part_index}")
        for part_index in range(part_count)
    }

    for band_index in range(band_count):
        selected_parts = sum(
            assignment[band_index, part_index] for part_index in range(part_count)
        )
        if allow_partial:
            model.add(selected_parts == present[band_index])
        else:
            model.add(selected_parts == 1)
            model.add(present[band_index] == 1)

    for part_index in range(part_count):
        model.add(
            part_sizes[part_index]
            == sum(
                assignment[band_index, part_index] for band_index in range(band_count)
            )
        )
        for band_index in range(band_count):
            selected = assignment[band_index, part_index]
            model.add(local_order[band_index] < part_sizes[part_index]).only_enforce_if(
                selected
            )
            earlier_part_sizes = sum(part_sizes[index] for index in range(part_index))
            model.add(
                global_position[band_index]
                == earlier_part_sizes + local_order[band_index]
            ).only_enforce_if(selected)
        for left_index in range(band_count):
            for right_index in range(left_index + 1, band_count):
                model.add(
                    local_order[left_index] != local_order[right_index]
                ).only_enforce_if(
                    [
                        assignment[left_index, part_index],
                        assignment[right_index, part_index],
                    ]
                )

    if allow_partial:
        if band_count < 2:
            model.add(0 == 1)
        else:
            model.add(sum(present.values()) >= 1)
            model.add(sum(present.values()) <= band_count - 1)

    band_indexes = {band.bandId: index for index, band in enumerate(bands)}
    part_indexes = {part.partId: index for index, part in enumerate(parts)}
    for placement in request.currentPlacements:
        band_index = band_indexes[placement.bandId]
        part_index = part_indexes[placement.partId]
        model.add_hint(assignment[band_index, part_index], 1)
        model.add_hint(local_order[band_index], placement.order)

    for wrapped in request.constraints:
        constraint = wrapped.root
        if not constraint.enabled:
            continue
        target = constraint.targets
        params = constraint.params
        if constraint.type == "at_position":
            band_index = band_indexes[target.band_id]
            model.add(global_position[band_index] == params.position).only_enforce_if(
                present[band_index]
            )
        elif constraint.type == "in_range":
            target_indexes = [band_indexes[band_id.root] for band_id in target.band_ids]
            if params.kind == "positions":
                for band_index in target_indexes:
                    model.add(
                        global_position[band_index] >= params.position_from
                    ).only_enforce_if(present[band_index])
                    model.add(
                        global_position[band_index] <= params.position_to
                    ).only_enforce_if(present[band_index])
            else:
                allowed_part_orders = {part_id.root for part_id in params.part_ids}
                allowed_part_indexes = [
                    part_index
                    for part_index, part in enumerate(parts)
                    if part.sortOrder in allowed_part_orders
                ]
                for band_index in target_indexes:
                    model.add(
                        sum(
                            assignment[band_index, part_index]
                            for part_index in allowed_part_indexes
                        )
                        == present[band_index]
                    )
        elif constraint.type == "before":
            before_index = band_indexes[target.before_band_id]
            after_index = band_indexes[target.after_band_id]
            model.add(
                global_position[before_index] < global_position[after_index]
            ).only_enforce_if([present[before_index], present[after_index]])
        elif constraint.type in ("min_gap_member", "min_gap_bands"):
            if constraint.type == "min_gap_member":
                target_bands = [
                    membership.bandId
                    for membership in request.memberships
                    if membership.memberId == target.member_id
                ]
            else:
                target_bands = [band_id.root for band_id in target.band_ids]
            for pair_index, (left_id, right_id) in enumerate(
                combinations(target_bands, 2)
            ):
                left_index = band_indexes[left_id]
                right_index = band_indexes[right_id]
                difference = model.new_int_var(
                    0, band_count - 1, f"gap_{constraint.constraint_id}_{pair_index}"
                )
                model.add_abs_equality(
                    difference,
                    global_position[left_index] - global_position[right_index],
                )
                if params.same_part_only:
                    for part_index in range(part_count):
                        model.add(difference >= params.min_diff).only_enforce_if(
                            [
                                assignment[left_index, part_index],
                                assignment[right_index, part_index],
                            ]
                        )
                else:
                    model.add(difference >= params.min_diff).only_enforce_if(
                        [present[left_index], present[right_index]]
                    )

    return ModelVariables(model, assignment, present, local_order, global_position)


def _constraint_results(
    request: SolveRequest, placements: list[CurrentPlacement]
) -> list[ConstraintResult]:
    parts = sorted(request.parts, key=lambda part: part.sortOrder)
    part_offsets: dict[str, int] = {}
    offset = 0
    counts = {
        part.partId: sum(placement.partId == part.partId for placement in placements)
        for part in parts
    }
    for part in parts:
        part_offsets[part.partId] = offset
        offset += counts[part.partId]

    positions = {
        placement.bandId: part_offsets[placement.partId] + placement.order
        for placement in placements
    }
    part_by_band = {placement.bandId: placement.partId for placement in placements}
    part_orders = {part.partId: part.sortOrder for part in parts}
    results = []
    for wrapped in request.constraints:
        constraint = wrapped.root
        if not constraint.enabled:
            result = "disabled"
        elif constraint.type == "count":
            # Count semantics are intentionally not applied yet.
            result = "unchecked"
        elif constraint.type == "in_range":
            target_bands = [band_id.root for band_id in constraint.targets.band_ids]
            if any(band_id not in positions for band_id in target_bands):
                result = "unchecked"
            elif constraint.params.kind == "positions":
                result = (
                    "met"
                    if all(
                        constraint.params.position_from
                        <= positions[band_id]
                        <= constraint.params.position_to
                        for band_id in target_bands
                    )
                    else "unmet"
                )
            else:
                allowed_part_orders = {
                    part_id.root for part_id in constraint.params.part_ids
                }
                result = (
                    "met"
                    if all(
                        part_orders[part_by_band[band_id]] in allowed_part_orders
                        for band_id in target_bands
                    )
                    else "unmet"
                )
        elif constraint.type == "at_position":
            band_id = constraint.targets.band_id
            if band_id not in positions:
                result = "unchecked"
            else:
                result = (
                    "met"
                    if positions[band_id] == constraint.params.position
                    else "unmet"
                )
        elif constraint.type == "before":
            before_id = constraint.targets.before_band_id
            after_id = constraint.targets.after_band_id
            if before_id not in positions or after_id not in positions:
                result = "unchecked"
            else:
                result = (
                    "met" if positions[before_id] < positions[after_id] else "unmet"
                )
        elif constraint.type in ("min_gap_member", "min_gap_bands"):
            if constraint.type == "min_gap_member":
                target_bands = [
                    membership.bandId
                    for membership in request.memberships
                    if membership.memberId == constraint.targets.member_id
                ]
            else:
                target_bands = [band_id.root for band_id in constraint.targets.band_ids]
            if any(band_id not in positions for band_id in target_bands):
                result = "unchecked"
            else:
                satisfied = all(
                    abs(positions[left_id] - positions[right_id])
                    >= constraint.params.min_diff
                    for left_id, right_id in combinations(target_bands, 2)
                    if not constraint.params.same_part_only
                    or part_by_band[left_id] == part_by_band[right_id]
                )
                result = "met" if satisfied else "unmet"
        else:
            # Unsupported active constraints are rejected before model construction.
            raise NotImplementedError(f"未対応の制約です: {constraint.type}")
        results.append(
            ConstraintResult(constraintId=constraint.constraint_id, status=result)
        )
    return results


def _make_placements(
    request: SolveRequest, variables: ModelVariables, solver: cp_model.CpSolver
) -> list[CurrentPlacement]:
    parts = sorted(request.parts, key=lambda part: part.sortOrder)
    placements = []
    for part_index, part in enumerate(parts):
        in_part = [
            band_index
            for band_index, band in enumerate(request.bands)
            if solver.boolean_value(variables.assignment[band_index, part_index])
        ]
        in_part.sort(
            key=lambda band_index: solver.value(variables.local_order[band_index])
        )
        placements.extend(
            CurrentPlacement(
                bandId=request.bands[band_index].bandId,
                partId=part.partId,
                order=order,
            )
            for order, band_index in enumerate(in_part)
        )
    return placements


def _solve_model(variables: ModelVariables) -> tuple[cp_model.CpSolver, int]:
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    return solver, solver.solve(variables.model)


def solve_request(request: SolveRequest) -> SolveResponse:
    """Solve the supported hard constraints in the request."""
    unsupported = [
        item.root
        for item in request.constraints
        if item.root.enabled
        and item.root.type != "count"
        and (
            item.root.hardness != "hard"
            or item.root.type
            not in (
                "at_position",
                "before",
                "in_range",
                "min_gap_member",
                "min_gap_bands",
            )
        )
    ]
    if unsupported:
        types = sorted({str(item.type) for item in unsupported})
        raise NotImplementedError("未対応の制約です: " + ", ".join(types))

    full_model = _build_model(request, allow_partial=False)
    full_solver, full_status = _solve_model(full_model)
    if full_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        placements = _make_placements(request, full_model, full_solver)
        return build_response(
            request,
            "feasible",
            placements=placements,
            unassigned_band_ids=[],
            constraint_results=_constraint_results(request, placements),
        )
    if full_status != cp_model.INFEASIBLE:
        return build_response(request, "unknown")

    partial_model = _build_model(request, allow_partial=True)
    partial_solver, partial_status = _solve_model(partial_model)
    if partial_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        placements = _make_placements(request, partial_model, partial_solver)
        placed_ids = {placement.bandId for placement in placements}
        unassigned_ids = [
            band.bandId for band in request.bands if band.bandId not in placed_ids
        ]
        return build_response(
            request,
            "partial",
            placements=placements,
            unassigned_band_ids=unassigned_ids,
            constraint_results=_constraint_results(request, placements),
        )
    # Full infeasibility was proved; no partial arrangement was found within this
    # search. The contract does not claim that a partial arrangement is impossible.
    return build_response(request, "infeasible")
