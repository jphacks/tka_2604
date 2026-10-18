"""Parse and validate the BE-to-Solver request independently of its transport."""

from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, model_validator

from generated.constraint import Constraint


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Part(InputModel):
    partId: str = Field(min_length=1)
    sortOrder: int = Field(ge=0)
    bandCount: int | None = Field(default=None, ge=0)


class Band(InputModel):
    bandId: str = Field(min_length=1)


class Member(InputModel):
    memberId: str = Field(min_length=1)


class Membership(InputModel):
    bandId: str = Field(min_length=1)
    memberId: str = Field(min_length=1)


class CurrentPlacement(InputModel):
    bandId: str = Field(min_length=1)
    partId: str = Field(min_length=1)
    order: int = Field(ge=0)


def _unique(values: list[object], label: str) -> None:
    if len(values) != len(set(values)):
        raise ValueError(f"{label}に重複があります")


class SolveRequest(InputModel):
    eventId: str = Field(min_length=1)
    parts: list[Part] = Field(min_length=1)
    bands: list[Band] = Field(min_length=1)
    members: list[Member]
    memberships: list[Membership]
    constraints: list[Constraint]
    currentPlacements: list[CurrentPlacement]

    @model_validator(mode="after")
    def validate_references(self) -> "SolveRequest":
        part_ids = {part.partId for part in self.parts}
        part_orders = {part.sortOrder for part in self.parts}
        band_ids = {band.bandId for band in self.bands}
        member_ids = {member.memberId for member in self.members}
        _unique([part.partId for part in self.parts], "parts[].partId")
        _unique([part.sortOrder for part in self.parts], "parts[].sortOrder")
        band_counts = [part.bandCount for part in self.parts]
        if any(count is not None for count in band_counts):
            if any(count is None for count in band_counts):
                raise ValueError("parts[].bandCountはすべての部で指定してください")
        _unique([band.bandId for band in self.bands], "bands[].bandId")
        _unique([member.memberId for member in self.members], "members[].memberId")
        _unique(
            [(item.bandId, item.memberId) for item in self.memberships],
            "memberships",
        )
        for item in self.memberships:
            if item.bandId not in band_ids or item.memberId not in member_ids:
                raise ValueError("membershipsに存在しないbandId/memberIdがあります")

        _unique(
            [item.bandId for item in self.currentPlacements],
            "currentPlacements[].bandId",
        )
        _unique(
            [(item.partId, item.order) for item in self.currentPlacements],
            "currentPlacementsの部内順",
        )
        for item in self.currentPlacements:
            if item.bandId not in band_ids or item.partId not in part_ids:
                raise ValueError("currentPlacementsに存在しないbandId/partIdがあります")
            if item.order >= len(self.bands):
                raise ValueError("currentPlacements[].orderがバンド数以上です")

        _unique(
            [item.root.constraint_id for item in self.constraints],
            "constraints[].constraint_id",
        )
        for wrapped in self.constraints:
            item = wrapped.root
            if item.event_id != self.eventId:
                raise ValueError(f"制約{item.constraint_id}のevent_idが一致しません")
            priority = item.priority.root if item.priority is not None else None
            if (item.hardness == "hard") != (priority is None):
                raise ValueError(
                    f"制約{item.constraint_id}のhardness/priorityが不正です"
                )
            if not item.enabled:
                # Stale references on disabled constraints are still an open contract point.
                continue
            target = item.targets
            params = item.params
            if item.type == "min_gap_member":
                if target.member_id not in member_ids:
                    raise ValueError(
                        f"制約{item.constraint_id}のmember_idが存在しません"
                    )
            elif item.type == "before":
                if (
                    target.before_band_id not in band_ids
                    or target.after_band_id not in band_ids
                    or target.before_band_id == target.after_band_id
                ):
                    raise ValueError(f"制約{item.constraint_id}の対象バンドが不正です")
            else:
                target_ids = (
                    [target.band_id]
                    if item.type == "at_position"
                    else [band_id.root for band_id in target.band_ids]
                )
                if (
                    len(set(target_ids)) != len(target_ids)
                    or not set(target_ids) <= band_ids
                ):
                    raise ValueError(f"制約{item.constraint_id}の対象バンドが不正です")
            if item.type == "at_position" and params.position >= len(self.bands):
                raise ValueError(f"制約{item.constraint_id}のpositionが範囲外です")
            if item.type == "in_range":
                if params.kind == "positions":
                    if (
                        params.position_from > params.position_to
                        or params.position_to >= len(self.bands)
                    ):
                        raise ValueError(
                            f"制約{item.constraint_id}の位置範囲が不正です"
                        )
                elif not {part_id.root for part_id in params.part_ids} <= part_orders:
                    raise ValueError(
                        f"制約{item.constraint_id}のpart_idsが存在しません"
                    )
            if item.type == "count":
                if params.min > params.max:
                    raise ValueError(
                        f"制約{item.constraint_id}のminがmaxを超えています"
                    )
                if (
                    params.scope == "in_parts"
                    and not {part_id.root for part_id in params.part_ids} <= part_orders
                ):
                    raise ValueError(
                        f"制約{item.constraint_id}のpart_idsが存在しません"
                    )
        return self


def load_request(path: Path) -> SolveRequest:
    return SolveRequest.model_validate_json(path.read_text(encoding="utf-8"))


def parse_request_json(data: str) -> SolveRequest:
    """Also usable by the future HTTP adapter."""
    return SolveRequest.model_validate_json(data)
