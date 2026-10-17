"""Compile scheduling constraints and evaluate them against placements."""

from dataclasses import dataclass
from itertools import combinations
from typing import Any

from ortools.sat.python import cp_model

from solver_input import CurrentPlacement, Part, SolveRequest
from solver_output import ConstraintResult

PRIORITY_WEIGHT = {"high": 3, "mid": 2, "low": 1}


@dataclass(frozen=True)
class SoftPenalty:
    weight: int
    violated: cp_model.IntVar


def _or_var(
    model: cp_model.CpModel, values: list[cp_model.IntVar], name: str
) -> cp_model.IntVar:
    result = model.new_bool_var(name)
    if values:
        model.add_max_equality(result, values)
    else:
        model.add(result == 0)
    return result


def _soft_violation(constraint: Any, violated: cp_model.IntVar) -> SoftPenalty:
    priority = constraint.priority.root
    return SoftPenalty(PRIORITY_WEIGHT[str(priority)], violated)


def _add_gap_constraint(
    model: cp_model.CpModel,
    request: SolveRequest,
    constraint: Any,
    band_indexes: dict[str, int],
    assignment: dict[tuple[int, int], cp_model.IntVar],
    present: dict[int, cp_model.IntVar],
    global_position: dict[int, cp_model.IntVar],
    part_count: int,
) -> SoftPenalty | None:
    if constraint.type == "min_gap_member":
        target_bands = [
            membership.bandId
            for membership in request.memberships
            if membership.memberId == constraint.targets.member_id
        ]
    else:
        target_bands = [band_id.root for band_id in constraint.targets.band_ids]

    pair_violations: list[cp_model.IntVar] = []
    for pair_index, (left_id, right_id) in enumerate(combinations(target_bands, 2)):
        left_index = band_indexes[left_id]
        right_index = band_indexes[right_id]
        difference = model.new_int_var(
            0,
            len(request.bands) - 1,
            f"gap_{constraint.constraint_id}_{pair_index}",
        )
        model.add_abs_equality(
            difference,
            global_position[left_index] - global_position[right_index],
        )

        if constraint.hardness == "hard":
            if constraint.params.same_part_only:
                for part_index in range(part_count):
                    model.add(difference >= constraint.params.min_diff).only_enforce_if(
                        [
                            assignment[left_index, part_index],
                            assignment[right_index, part_index],
                        ]
                    )
            else:
                model.add(difference >= constraint.params.min_diff).only_enforce_if(
                    [present[left_index], present[right_index]]
                )
            continue

        pair_violation = model.new_bool_var(
            f"violated_{constraint.constraint_id}_{pair_index}"
        )
        pair_violations.append(pair_violation)
        if constraint.params.same_part_only:
            for part_index in range(part_count):
                both_in_part = [
                    assignment[left_index, part_index],
                    assignment[right_index, part_index],
                ]
                model.add(difference >= constraint.params.min_diff).only_enforce_if(
                    both_in_part + [pair_violation.Not()]
                )
                model.add(difference < constraint.params.min_diff).only_enforce_if(
                    both_in_part + [pair_violation]
                )
        else:
            both_present = [present[left_index], present[right_index]]
            model.add(difference >= constraint.params.min_diff).only_enforce_if(
                both_present + [pair_violation.Not()]
            )
            model.add(difference < constraint.params.min_diff).only_enforce_if(
                both_present + [pair_violation]
            )

    if constraint.hardness == "hard":
        return None
    violated = _or_var(model, pair_violations, f"violated_{constraint.constraint_id}")
    return _soft_violation(constraint, violated)


def _add_constraint(
    model: cp_model.CpModel,
    request: SolveRequest,
    constraint: Any,
    band_indexes: dict[str, int],
    assignment: dict[tuple[int, int], cp_model.IntVar],
    present: dict[int, cp_model.IntVar],
    global_position: dict[int, cp_model.IntVar],
    parts: list[Part],
) -> SoftPenalty | None:
    if not constraint.enabled or constraint.type == "count":
        return None

    is_soft = constraint.hardness == "soft"
    targets = constraint.targets
    params = constraint.params

    if constraint.type in ("min_gap_member", "min_gap_bands"):
        return _add_gap_constraint(
            model,
            request,
            constraint,
            band_indexes,
            assignment,
            present,
            global_position,
            len(parts),
        )

    if constraint.type == "at_position":
        band_index = band_indexes[targets.band_id]
        if not is_soft:
            model.add(global_position[band_index] == params.position).only_enforce_if(
                present[band_index]
            )
            return None

        violated = model.new_bool_var(f"violated_{constraint.constraint_id}")
        assigned = present[band_index]
        model.add(global_position[band_index] == params.position).only_enforce_if(
            [assigned, violated.Not()]
        )
        model.add(global_position[band_index] != params.position).only_enforce_if(
            [assigned, violated]
        )
        return _soft_violation(constraint, violated)

    if constraint.type == "before":
        before_index = band_indexes[targets.before_band_id]
        after_index = band_indexes[targets.after_band_id]
        both_present = [present[before_index], present[after_index]]
        if not is_soft:
            model.add(
                global_position[before_index] < global_position[after_index]
            ).only_enforce_if(both_present)
            return None

        violated = model.new_bool_var(f"violated_{constraint.constraint_id}")
        model.add(
            global_position[before_index] < global_position[after_index]
        ).only_enforce_if(both_present + [violated.Not()])
        model.add(
            global_position[before_index] >= global_position[after_index]
        ).only_enforce_if(both_present + [violated])
        return _soft_violation(constraint, violated)

    if constraint.type == "in_range":
        target_indexes = [band_indexes[band_id.root] for band_id in targets.band_ids]
        target_violations: list[cp_model.IntVar] = []
        if params.kind == "positions":
            for target_index in target_indexes:
                if not is_soft:
                    model.add(
                        global_position[target_index] >= params.position_from
                    ).only_enforce_if(present[target_index])
                    model.add(
                        global_position[target_index] <= params.position_to
                    ).only_enforce_if(present[target_index])
                    continue

                below = model.new_bool_var(
                    f"below_{constraint.constraint_id}_{target_index}"
                )
                above = model.new_bool_var(
                    f"above_{constraint.constraint_id}_{target_index}"
                )
                model.add(
                    global_position[target_index] < params.position_from
                ).only_enforce_if([present[target_index], below])
                model.add(
                    global_position[target_index] >= params.position_from
                ).only_enforce_if([present[target_index], below.Not()])
                model.add(
                    global_position[target_index] > params.position_to
                ).only_enforce_if([present[target_index], above])
                model.add(
                    global_position[target_index] <= params.position_to
                ).only_enforce_if([present[target_index], above.Not()])
                target_violations.append(
                    _or_var(
                        model,
                        [below, above],
                        f"violated_{constraint.constraint_id}_{target_index}",
                    )
                )
        else:
            allowed_part_orders = {part_id.root for part_id in params.part_ids}
            allowed_part_indexes = [
                index
                for index, part in enumerate(parts)
                if part.sortOrder in allowed_part_orders
            ]
            for target_index in target_indexes:
                allowed_assignments = sum(
                    assignment[target_index, part_index]
                    for part_index in allowed_part_indexes
                )
                if not is_soft:
                    model.add(allowed_assignments == present[target_index])
                    continue

                target_violation = model.new_bool_var(
                    f"violated_{constraint.constraint_id}_{target_index}"
                )
                model.add(allowed_assignments == 1).only_enforce_if(
                    [present[target_index], target_violation.Not()]
                )
                model.add(allowed_assignments == 0).only_enforce_if(
                    [present[target_index], target_violation]
                )
                target_violations.append(target_violation)

        if not is_soft:
            return None
        violated = _or_var(
            model, target_violations, f"violated_{constraint.constraint_id}"
        )
        return _soft_violation(constraint, violated)

    raise NotImplementedError(f"未対応の制約です: {constraint.type}")


def add_constraints(
    model: cp_model.CpModel,
    request: SolveRequest,
    band_indexes: dict[str, int],
    assignment: dict[tuple[int, int], cp_model.IntVar],
    present: dict[int, cp_model.IntVar],
    global_position: dict[int, cp_model.IntVar],
    parts: list[Part],
) -> list[SoftPenalty]:
    penalties = []
    for wrapped in request.constraints:
        penalty = _add_constraint(
            model,
            request,
            wrapped.root,
            band_indexes,
            assignment,
            present,
            global_position,
            parts,
        )
        if penalty is not None:
            penalties.append(penalty)
    return penalties


def evaluate_constraints(
    request: SolveRequest, placements: list[CurrentPlacement]
) -> list[ConstraintResult]:
    """Evaluate returned placements, including only constraints with full targets."""
    parts = sorted(request.parts, key=lambda part: part.sortOrder)
    counts = {
        part.partId: sum(placement.partId == part.partId for placement in placements)
        for part in parts
    }
    offsets: dict[str, int] = {}
    offset = 0
    for part in parts:
        offsets[part.partId] = offset
        offset += counts[part.partId]
    positions = {
        placement.bandId: offsets[placement.partId] + placement.order
        for placement in placements
    }
    part_by_band = {placement.bandId: placement.partId for placement in placements}
    sort_order_by_part = {part.partId: part.sortOrder for part in parts}
    results = []

    for wrapped in request.constraints:
        constraint = wrapped.root
        if not constraint.enabled:
            status = "disabled"
        elif constraint.type == "count":
            status = "unchecked"
        elif constraint.type == "at_position":
            band_id = constraint.targets.band_id
            status = (
                "unchecked"
                if band_id not in positions
                else (
                    "met"
                    if positions[band_id] == constraint.params.position
                    else "unmet"
                )
            )
        elif constraint.type == "before":
            before_id = constraint.targets.before_band_id
            after_id = constraint.targets.after_band_id
            status = (
                "unchecked"
                if before_id not in positions or after_id not in positions
                else "met" if positions[before_id] < positions[after_id] else "unmet"
            )
        elif constraint.type == "in_range":
            target_bands = [band_id.root for band_id in constraint.targets.band_ids]
            if any(band_id not in positions for band_id in target_bands):
                status = "unchecked"
            elif constraint.params.kind == "positions":
                status = (
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
                status = (
                    "met"
                    if all(
                        sort_order_by_part[part_by_band[band_id]] in allowed_part_orders
                        for band_id in target_bands
                    )
                    else "unmet"
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
                status = "unchecked"
            else:
                status = (
                    "met"
                    if all(
                        abs(positions[left_id] - positions[right_id])
                        >= constraint.params.min_diff
                        for left_id, right_id in combinations(target_bands, 2)
                        if not constraint.params.same_part_only
                        or part_by_band[left_id] == part_by_band[right_id]
                    )
                    else "unmet"
                )
        else:
            raise NotImplementedError(f"未対応の制約です: {constraint.type}")
        results.append(
            ConstraintResult(constraintId=constraint.constraint_id, status=status)
        )
    return results
