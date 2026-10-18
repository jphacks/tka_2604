"""CP-SAT calculation for the BE-to-Solver contract."""

from dataclasses import dataclass

from ortools.sat.python import cp_model

from solver_constraints import add_constraints, evaluate_constraints
from solver_input import CurrentPlacement, SolveRequest
from solver_output import SolveResponse, build_response


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
        if parts[part_index].bandCount is not None:
            model.add(part_sizes[part_index] <= parts[part_index].bandCount)
        model.add(
            part_sizes[part_index]
            == sum(
                assignment[band_index, part_index] for band_index in range(band_count)
            )
        )
        if parts[part_index].bandCount is not None:
            model.add(part_sizes[part_index] <= parts[part_index].bandCount)
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

    soft_penalties = add_constraints(
        model,
        request,
        band_indexes,
        assignment,
        present,
        global_position,
        parts,
    )
    penalty = sum(item.weight * item.violated for item in soft_penalties)
    if allow_partial:
        # Fill as many configured slots as possible before optimizing soft wishes.
        model.maximize(
            sum(present.values()) * (sum(item.weight for item in soft_penalties) + 1)
            - penalty
        )
    elif soft_penalties:
        model.minimize(penalty)

    return ModelVariables(model, assignment, present, local_order, global_position)


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
    """Find a hard-feasible placement with the lowest soft-constraint penalty."""
    unsupported = [
        item.root
        for item in request.constraints
        if item.root.enabled
        and item.root.type != "count"
        and item.root.type
        not in (
            "at_position",
            "before",
            "in_range",
            "min_gap_member",
            "min_gap_bands",
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
            "optimal" if full_status == cp_model.OPTIMAL else "feasible",
            placements=placements,
            unassigned_band_ids=[],
            constraint_results=evaluate_constraints(request, placements),
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
            constraint_results=evaluate_constraints(request, placements),
        )
    # Full infeasibility was proved; no partial arrangement was found within this
    # search. The contract does not claim that a partial arrangement is impossible.
    return build_response(request, "infeasible")
