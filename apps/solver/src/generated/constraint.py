# Generated from apps/schema/*.schema.json. DO NOT EDIT. Run npm run codegen to regenerate.

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, RootModel, conint, constr


class Type(StrEnum):
    min_gap_member = 'min_gap_member'


class SchemaVersion(StrEnum):
    field_1_0_0 = '1.0.0'


class Hardness(StrEnum):
    hard = 'hard'
    soft = 'soft'


class Priority1(StrEnum):
    high = 'high'
    mid = 'mid'
    low = 'low'


class Priority(RootModel[Priority1 | None]):
    root: Priority1 | None = Field(..., title='Priority')


class MinGapMemberTargets(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    member_id: constr(min_length=1)


class MinGapMemberParams(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    min_diff: conint(ge=2)
    same_part_only: bool


class Type1(StrEnum):
    min_gap_bands = 'min_gap_bands'


class BandId(RootModel[constr(min_length=1)]):
    root: constr(min_length=1)


class MinGapBandsTargets(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    band_ids: list[BandId] = Field(..., min_length=2)


class MinGapBandsParams(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    min_diff: conint(ge=2)
    same_part_only: bool


class Type2(StrEnum):
    before = 'before'


class BeforeTargets(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    before_band_id: constr(min_length=1)
    after_band_id: constr(min_length=1)


class BeforeParams(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )


class Type3(StrEnum):
    at_position = 'at_position'


class AtPositionTargets(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    band_id: constr(min_length=1)


class AtPositionParams(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    position: conint(ge=0)


class Type4(StrEnum):
    in_range = 'in_range'


class InRangeTargets(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    band_ids: list[BandId] = Field(..., min_length=1)


class Kind(StrEnum):
    positions = 'positions'


class InRangePositionParams(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    kind: Kind
    position_from: conint(ge=0)
    position_to: conint(ge=0)


class Kind1(StrEnum):
    parts = 'parts'


class PartId(RootModel[conint(ge=0)]):
    root: conint(ge=0)


class InRangePartParams(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    kind: Kind1
    part_ids: list[PartId] = Field(..., min_length=1)


class Type5(StrEnum):
    count = 'count'


class CountTargets(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    band_ids: list[BandId] = Field(..., min_length=1)


class Scope(StrEnum):
    per_part = 'per_part'


class CountPerPartParams(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    scope: Scope
    min: conint(ge=0)
    max: conint(ge=0)


class Scope1(StrEnum):
    in_parts = 'in_parts'


class CountInPartsParams(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    scope: Scope1
    part_ids: list[PartId] = Field(..., min_length=1)
    min: conint(ge=0)
    max: conint(ge=0)


class MinGapMemberConstraint(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: SchemaVersion
    constraint_id: constr(min_length=1)
    event_id: constr(min_length=1)
    type: Type
    hardness: Hardness
    priority: Priority | None
    enabled: bool
    source_text: str | None = None
    targets: MinGapMemberTargets
    params: MinGapMemberParams


class MinGapBandsConstraint(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: SchemaVersion
    constraint_id: constr(min_length=1)
    event_id: constr(min_length=1)
    type: Type1
    hardness: Hardness
    priority: Priority | None
    enabled: bool
    source_text: str | None = None
    targets: MinGapBandsTargets
    params: MinGapBandsParams


class BeforeConstraint(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: SchemaVersion
    constraint_id: constr(min_length=1)
    event_id: constr(min_length=1)
    type: Type2
    hardness: Hardness
    priority: Priority | None
    enabled: bool
    source_text: str | None = None
    targets: BeforeTargets
    params: BeforeParams


class AtPositionConstraint(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: SchemaVersion
    constraint_id: constr(min_length=1)
    event_id: constr(min_length=1)
    type: Type3
    hardness: Hardness
    priority: Priority | None
    enabled: bool
    source_text: str | None = None
    targets: AtPositionTargets
    params: AtPositionParams


class InRangeConstraint(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: SchemaVersion
    constraint_id: constr(min_length=1)
    event_id: constr(min_length=1)
    type: Type4
    hardness: Hardness
    priority: Priority | None
    enabled: bool
    source_text: str | None = None
    targets: InRangeTargets
    params: InRangePositionParams | InRangePartParams


class CountConstraint(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schema_version: SchemaVersion
    constraint_id: constr(min_length=1)
    event_id: constr(min_length=1)
    type: Type5
    hardness: Hardness
    priority: Priority | None
    enabled: bool
    source_text: str | None = None
    targets: CountTargets
    params: CountPerPartParams | CountInPartsParams


class Constraint(
    RootModel[
        MinGapMemberConstraint
        | MinGapBandsConstraint
        | BeforeConstraint
        | AtPositionConstraint
        | InRangeConstraint
        | CountConstraint
    ]
):
    root: (
        MinGapMemberConstraint
        | MinGapBandsConstraint
        | BeforeConstraint
        | AtPositionConstraint
        | InRangeConstraint
        | CountConstraint
    ) = Field(..., title='Constraint')
