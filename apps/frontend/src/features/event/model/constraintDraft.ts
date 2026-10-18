import type {
  Constraint,
  Hardness,
  Priority,
} from '../../../generated/constraint'
import { validateConstraint } from '../../../shared/model/constraints'
import type { EventData } from '../../../shared/model/event'

/** Editable strings stay in the form; only a validated schema constraint is saved. */
export interface ConstraintDraft {
  type: Constraint['type']
  hardness: Hardness
  priority: Exclude<Priority, null>
  enabled: boolean
  sourceText: string
  bandIds: string[]
  memberId: string
  beforeId: string
  afterId: string
  between: string
  samePartOnly: boolean
  position: string
  rangeKind: 'positions' | 'parts'
  from: string
  to: string
  partIds: number[]
  countScope: 'per_part' | 'in_parts'
  min: string
  max: string
}

export function createConstraintDraft(
  constraint?: Constraint,
): ConstraintDraft {
  const draft: ConstraintDraft = {
    type: constraint?.type ?? 'min_gap_member',
    hardness: constraint?.hardness ?? 'hard',
    priority: constraint?.priority ?? 'mid',
    enabled: constraint?.enabled ?? true,
    sourceText: constraint?.source_text ?? '',
    bandIds: [],
    memberId: '',
    beforeId: '',
    afterId: '',
    between: '1',
    samePartOnly: false,
    position: '',
    rangeKind: 'positions',
    from: '',
    to: '',
    partIds: [],
    countScope: 'per_part',
    min: '0',
    max: '',
  }
  if (!constraint) return draft
  switch (constraint.type) {
    case 'min_gap_member':
      return {
        ...draft,
        memberId: constraint.targets.member_id,
        between: String(constraint.params.min_diff - 1),
        samePartOnly: constraint.params.same_part_only,
      }
    case 'min_gap_bands':
      return {
        ...draft,
        bandIds: constraint.targets.band_ids,
        between: String(constraint.params.min_diff - 1),
        samePartOnly: constraint.params.same_part_only,
      }
    case 'before':
      return {
        ...draft,
        beforeId: constraint.targets.before_band_id,
        afterId: constraint.targets.after_band_id,
      }
    case 'at_position':
      return {
        ...draft,
        bandIds: [constraint.targets.band_id],
        position: String(constraint.params.position + 1),
      }
    case 'in_range':
      return {
        ...draft,
        bandIds: constraint.targets.band_ids,
        rangeKind: constraint.params.kind,
        ...(constraint.params.kind === 'positions'
          ? {
              from: String(constraint.params.position_from + 1),
              to: String(constraint.params.position_to + 1),
            }
          : { partIds: constraint.params.part_ids }),
      }
    case 'count':
      return {
        ...draft,
        bandIds: constraint.targets.band_ids,
        countScope: constraint.params.scope,
        min: String(constraint.params.min),
        max: String(constraint.params.max),
        partIds:
          constraint.params.scope === 'in_parts'
            ? constraint.params.part_ids
            : [],
      }
  }
}

type BuildResult =
  { ok: true; constraint: Constraint } | { ok: false; error: string }
export function buildConstraint(
  draft: ConstraintDraft,
  event: EventData,
  id: string,
): BuildResult {
  const integer = (value: string) =>
    /^\d+$/.test(value.trim()) ? Number(value) : NaN
  const base = {
    schema_version: '1.0.0' as const,
    constraint_id: id,
    event_id: event.id,
    hardness: draft.hardness,
    priority: draft.hardness === 'hard' ? null : draft.priority,
    enabled: draft.enabled,
    ...(draft.sourceText.trim()
      ? { source_text: draft.sourceText.trim() }
      : {}),
  }
  const [first, second, ...rest] = draft.bandIds
  const [part, ...parts] = draft.partIds
  let constraint: Constraint
  switch (draft.type) {
    case 'min_gap_member':
      constraint = {
        ...base,
        type: draft.type,
        targets: { member_id: draft.memberId },
        params: {
          min_diff: integer(draft.between) + 1,
          same_part_only: draft.samePartOnly,
        },
      }
      break
    case 'min_gap_bands':
      if (!first || !second)
        return {
          ok: false,
          error: '間隔を空ける出演枠を2組以上選んでください。',
        }
      constraint = {
        ...base,
        type: draft.type,
        targets: { band_ids: [first, second, ...rest] },
        params: {
          min_diff: integer(draft.between) + 1,
          same_part_only: draft.samePartOnly,
        },
      }
      break
    case 'before':
      constraint = {
        ...base,
        type: draft.type,
        targets: {
          before_band_id: draft.beforeId,
          after_band_id: draft.afterId,
        },
        params: {},
      }
      break
    case 'at_position':
      if (!first)
        return { ok: false, error: '位置を指定する出演枠を選んでください。' }
      constraint = {
        ...base,
        type: draft.type,
        targets: { band_id: first },
        params: { position: integer(draft.position) - 1 },
      }
      break
    case 'in_range':
      if (!first)
        return {
          ok: false,
          error: '範囲を指定する出演枠を1組以上選んでください。',
        }
      if (draft.rangeKind === 'parts' && part === undefined)
        return { ok: false, error: '出演できる部を1つ以上選んでください。' }
      constraint = {
        ...base,
        type: draft.type,
        targets: { band_ids: [first, ...draft.bandIds.slice(1)] },
        params:
          draft.rangeKind === 'positions'
            ? {
                kind: 'positions',
                position_from: integer(draft.from) - 1,
                position_to: integer(draft.to) - 1,
              }
            : { kind: 'parts', part_ids: [part, ...parts] },
      }
      break
    case 'count':
      if (!first)
        return {
          ok: false,
          error: '出演数を数える対象を1組以上選んでください。',
        }
      if (draft.countScope === 'in_parts' && part === undefined)
        return { ok: false, error: '合計する部を1つ以上選んでください。' }
      constraint = {
        ...base,
        type: draft.type,
        targets: { band_ids: [first, ...draft.bandIds.slice(1)] },
        params:
          draft.countScope === 'per_part'
            ? {
                scope: 'per_part',
                min: integer(draft.min),
                max: integer(draft.max),
              }
            : {
                scope: 'in_parts',
                part_ids: [part, ...parts],
                min: integer(draft.min),
                max: integer(draft.max),
              },
      }
      break
  }
  const error = validateConstraint(constraint, event)
  return error ? { ok: false, error } : { ok: true, constraint }
}

/** 対象のメンバーで選ぶと、掛け持ちしている全員に同じ間隔の制約を作る */
export const ALL_MULTI_MEMBERS = '__all_multi_members__'

export function multiMemberIds(event: EventData) {
  return event.members
    .filter(
      (member) =>
        event.performances.filter((band) => band.memberIds.includes(member.id))
          .length >= 2,
    )
    .map((member) => member.id)
}

export function buildConstraints(
  draft: ConstraintDraft,
  event: EventData,
  createId: () => string,
): { ok: true; constraints: Constraint[] } | { ok: false; error: string } {
  if (draft.type !== 'min_gap_member' || draft.memberId !== ALL_MULTI_MEMBERS) {
    const result = buildConstraint(draft, event, createId())
    return result.ok ? { ok: true, constraints: [result.constraint] } : result
  }
  const memberIds = multiMemberIds(event)
  if (!memberIds.length)
    return { ok: false, error: '掛け持ちしているメンバーがいません。' }
  const constraints: Constraint[] = []
  for (const memberId of memberIds) {
    const result = buildConstraint({ ...draft, memberId }, event, createId())
    if (!result.ok) return result
    constraints.push(result.constraint)
  }
  return { ok: true, constraints }
}
