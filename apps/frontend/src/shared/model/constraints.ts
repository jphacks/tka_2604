import type { Constraint } from '../../generated/constraint'
import { type EventData, positions } from './event'

export const constraintLabels: Record<Constraint['type'], string> = {
  min_gap_member: 'メンバーの出演間隔を空ける',
  min_gap_bands: '指定した出演枠の間隔を空ける',
  before: '出演の前後関係を決める',
  at_position: '出演位置を指定する',
  in_range: '出演できる範囲・部を指定する',
  count: '部ごとの出演数を決める',
}

export function targetBandIds(constraint: Constraint, event: EventData) {
  switch (constraint.type) {
    case 'min_gap_member':
      return event.performances
        .filter((band) => band.memberIds.includes(constraint.targets.member_id))
        .map((band) => band.id)
    case 'before':
      return [
        constraint.targets.before_band_id,
        constraint.targets.after_band_id,
      ]
    case 'at_position':
      return [constraint.targets.band_id]
    default:
      return constraint.targets.band_ids
  }
}

export function validateConstraint(
  constraint: Constraint,
  event: EventData,
): string {
  if (constraint.schema_version !== '1.0.0')
    return '制約の形式が対応していません。'
  if (!constraint.constraint_id.trim()) return '制約IDが必要です。'
  if (constraint.event_id !== event.id) return '別のイベントの制約です。'
  if (
    (constraint.hardness === 'hard' && constraint.priority !== null) ||
    (constraint.hardness === 'soft' &&
      !['high', 'mid', 'low'].includes(constraint.priority ?? ''))
  )
    return 'ハード条件の優先度は不要です。ソフト条件には優先度を選んでください。'
  if (
    constraint.type === 'min_gap_member' &&
    !event.members.some((member) => member.id === constraint.targets.member_id)
  ) {
    return '対象のメンバーを選んでください。'
  }
  const ids = targetBandIds(constraint, event)
  if (ids.some((id) => !event.performances.some((band) => band.id === id)))
    return '対象に存在しない出演枠があります。'
  if (new Set(ids).size !== ids.length)
    return '同じ出演枠を重複して指定できません。'
  if (
    constraint.type !== 'min_gap_member' &&
    ids.length < (constraint.type === 'min_gap_bands' ? 2 : 1)
  )
    return '対象の出演枠を選んでください。'
  const capacity = event.sections.reduce(
    (sum, section) => sum + section.slots.length,
    0,
  )
  const validPosition = (value: number) =>
    Number.isInteger(value) && value >= 0 && value < capacity
  const validParts = (parts: number[]) =>
    parts.length > 0 &&
    new Set(parts).size === parts.length &&
    parts.every(
      (part) =>
        Number.isInteger(part) && part >= 0 && part < event.sections.length,
    )
  switch (constraint.type) {
    case 'min_gap_member':
    case 'min_gap_bands':
      if (
        !Number.isInteger(constraint.params.min_diff) ||
        constraint.params.min_diff < 2
      )
        return '間に空ける出演枠は1組以上の整数にしてください。'
      break
    case 'at_position':
      if (!validPosition(constraint.params.position))
        return '出演位置を現在の枠数以内で指定してください。'
      break
    case 'in_range':
      if (constraint.params.kind === 'positions') {
        if (
          !validPosition(constraint.params.position_from) ||
          !validPosition(constraint.params.position_to) ||
          constraint.params.position_from > constraint.params.position_to
        )
          return '出演範囲の開始・終了を現在の枠数以内で指定してください。'
      } else if (!validParts(constraint.params.part_ids))
        return '存在する部を1つ以上選んでください。'
      break
    case 'count':
      if (
        !Number.isInteger(constraint.params.min) ||
        !Number.isInteger(constraint.params.max) ||
        constraint.params.min < 0 ||
        constraint.params.min > constraint.params.max
      )
        return '出演数の下限・上限を0以上の整数で指定してください。'
      if (
        constraint.params.scope === 'in_parts' &&
        !validParts(constraint.params.part_ids)
      )
        return '存在する部を1つ以上選んでください。'
      break
  }
  return ''
}

export function describeConstraint(
  constraint: Constraint,
  event: EventData,
): string {
  const name = (id: string) =>
    event.performances.find((band) => band.id === id)?.name ??
    '削除された出演枠'
  const names = (ids: string[]) => ids.map(name).join('・')
  const parts = (ids: number[]) => ids.map((id) => `第${id + 1}部`).join('・')
  switch (constraint.type) {
    case 'min_gap_member':
      return `${event.members.find((member) => member.id === constraint.targets.member_id)?.name ?? '不明なメンバー'}の出演の間に${constraint.params.min_diff - 1}組以上空ける${constraint.params.same_part_only ? '（同じ部のみ）' : '（部をまたいで適用）'}`
    case 'min_gap_bands':
      return `${names(constraint.targets.band_ids)}の全組合せで間に${constraint.params.min_diff - 1}組以上空ける${constraint.params.same_part_only ? '（同じ部のみ）' : '（部をまたいで適用）'}`
    case 'before':
      return `${name(constraint.targets.before_band_id)}を${name(constraint.targets.after_band_id)}より前にする`
    case 'at_position':
      return `${name(constraint.targets.band_id)}を${constraint.params.position + 1}番にする`
    case 'in_range':
      return `${names(constraint.targets.band_ids)}を${constraint.params.kind === 'positions' ? `${constraint.params.position_from + 1}〜${constraint.params.position_to + 1}番` : parts(constraint.params.part_ids)}に配置する`
    case 'count':
      return `${names(constraint.targets.band_ids)}を${constraint.params.scope === 'per_part' ? '各部に' : `${parts(constraint.params.part_ids)}の合計で`}${constraint.params.min}〜${constraint.params.max}組配置する`
  }
}

export type ConstraintStatus =
  'disabled' | 'unchecked' | 'met' | 'unmet' | 'invalid'
export function evaluateConstraint(
  constraint: Constraint,
  event: EventData,
): { status: ConstraintStatus; detail: string } {
  if (!constraint.enabled) return { status: 'disabled', detail: '無効' }
  const error = validateConstraint(constraint, event)
  if (error) return { status: 'invalid', detail: error }
  const placed = positions(event)
  const ids = targetBandIds(constraint, event)
  if (ids.some((id) => !placed.has(id)))
    return { status: 'unchecked', detail: '対象に未配置の出演枠があります' }
  let met = true
  switch (constraint.type) {
    case 'min_gap_member':
    case 'min_gap_bands':
      met = ids.every((id, index) =>
        ids.slice(index + 1).every((other) => {
          const a = placed.get(id)!
          const b = placed.get(other)!
          return (
            (constraint.params.same_part_only && a.part !== b.part) ||
            Math.abs(a.position - b.position) >= constraint.params.min_diff
          )
        }),
      )
      break
    case 'before':
      met =
        placed.get(constraint.targets.before_band_id)!.position <
        placed.get(constraint.targets.after_band_id)!.position
      break
    case 'at_position':
      met =
        placed.get(constraint.targets.band_id)!.position ===
        constraint.params.position
      break
    case 'in_range': {
      const params = constraint.params
      met = ids.every((id) => {
        const value = placed.get(id)!
        return params.kind === 'positions'
          ? value.position >= params.position_from &&
              value.position <= params.position_to
          : params.part_ids.includes(value.part)
      })
      break
    }
    case 'count': {
      const params = constraint.params
      const within = (count: number) =>
        count >= params.min && count <= params.max
      met =
        params.scope === 'per_part'
          ? event.sections.every((_, part) =>
              within(ids.filter((id) => placed.get(id)!.part === part).length),
            )
          : within(
              ids.filter((id) => params.part_ids.includes(placed.get(id)!.part))
                .length,
            )
      break
    }
  }
  return {
    status: met ? 'met' : 'unmet',
    detail: met
      ? '達成'
      : constraint.hardness === 'hard'
        ? 'ハード条件に違反'
        : '未達成',
  }
}
