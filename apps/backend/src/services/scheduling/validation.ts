import { z } from 'zod'

import type { Constraint } from '../../generated/constraint'
import { validateConstraint } from '../../shared/constraints/schema'
import { invalid } from './errors'
import type { ScheduleInput, Snapshot } from './types'

const id = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0)
export const placementSchema = z.strictObject({
  bandId: id,
  partId: id,
  order: z.number().int().nonnegative(),
})
export const saveScheduleSchema = z.strictObject({
  expectedUpdatedAt: z.iso.datetime(),
  parts: z
    .array(
      z.strictObject({
        partId: id,
        partName: z.string().nullable().default(null),
        bandCount: z.number().int().min(1).optional(),
      }),
    )
    .min(1)
    .max(8),
  placements: z.array(placementSchema),
  unassignedBandIds: z.array(id),
})
export const saveConstraintsSchema = z.strictObject({
  expectedUpdatedAt: z.iso.datetime(),
  constraints: z.array(z.custom<Constraint>(validateConstraint)),
})
export const unique = (values: string[]) =>
  new Set(values).size === values.length

export function validateSchedule(snapshot: Snapshot, input: ScheduleInput) {
  const bandIds = snapshot.bands.map((b) => b.bandId)
  const all = [
    ...input.placements.map((p) => p.bandId),
    ...input.unassignedBandIds,
  ]
  if (
    !unique(all) ||
    all.length !== bandIds.length ||
    all.some((id) => !bandIds.includes(id))
  )
    invalid(
      '/placements',
      '配置と未配置で、このイベントの全出演枠を重複なく指定してください。',
    )
  const partIds = input.parts.map((p) => p.partId)
  if (
    !unique(partIds) ||
    input.placements.some((p) => !partIds.includes(p.partId))
  )
    invalid('/parts', '部IDの重複または不正な配置先があります。')
  for (const part of input.parts) {
    const oldCount =
      snapshot.parts.find((p) => p.partId === part.partId)?.bandCount ?? 4
    const count = part.bandCount ?? oldCount
    if (
      (count > 20 && count !== oldCount) ||
      input.placements.filter((p) => p.partId === part.partId).length > count
    )
      invalid('/parts', '各部の組数は1〜20組で、配置数以上にしてください。')
    if (
      !unique(
        input.placements
          .filter((p) => p.partId === part.partId)
          .map((p) => String(p.order)),
      )
    )
      invalid('/placements', '部内のorderは重複なく指定してください。')
    if (
      input.placements.some((p) => p.partId === part.partId && p.order >= count)
    )
      invalid('/placements', '部内のorderが設定枠数を超えています。')
  }
  for (const part of snapshot.parts.filter((p) => !partIds.includes(p.partId)))
    if (
      snapshot.constraints.some((row) => {
        const value: unknown = JSON.parse(row.constraintJson)
        return (
          validateConstraint(value) &&
          'part_ids' in value.params &&
          value.params.part_ids.includes(part.sortOrder)
        )
      })
    )
      invalid(
        '/parts',
        '削除する部を参照する制約を先に変更・削除してください。',
      )
}

export function validateConstraints(
  snapshot: Snapshot,
  constraints: Constraint[],
) {
  if (!unique(constraints.map((c) => c.constraint_id)))
    invalid('/constraints', '制約IDが重複しています。')
  const bandIds = snapshot.bands.map((b) => b.bandId)
  for (const [i, c] of constraints.entries()) {
    const path = `/constraints/${i}`
    if (
      !validateConstraint(c) ||
      c.event_id !== snapshot.event.eventId ||
      (c.hardness === 'hard' ? c.priority !== null : c.priority === null)
    )
      invalid(path, '制約の形式・イベントID・優先度が不正です。')
    if (
      c.type === 'before' &&
      c.targets.before_band_id === c.targets.after_band_id
    )
      invalid(path, '前後関係には別の出演枠を指定してください。')
    if (c.type === 'count' && c.params.min > c.params.max)
      invalid(path, 'minはmax以下にしてください。')
    if (
      c.type === 'in_range' &&
      c.params.kind === 'positions' &&
      c.params.position_from > c.params.position_to
    )
      invalid(path, '範囲の開始は終了以下にしてください。')
    if (!c.enabled) continue
    const targets =
      c.type === 'min_gap_member'
        ? []
        : c.type === 'before'
          ? [c.targets.before_band_id, c.targets.after_band_id]
          : c.type === 'at_position'
            ? [c.targets.band_id]
            : c.targets.band_ids
    if (
      targets.some((id) => !bandIds.includes(id)) ||
      (c.type === 'min_gap_member' &&
        !snapshot.members.some((m) => m.memberId === c.targets.member_id))
    )
      invalid(path, '対象がこのイベントに存在しません。')
    if (
      'part_ids' in c.params &&
      c.params.part_ids.some(
        (n) => !snapshot.parts.some((p) => p.sortOrder === n),
      )
    )
      invalid(path, '参照する部が存在しません。')
    if (
      (c.type === 'at_position' && c.params.position >= bandIds.length) ||
      (c.type === 'in_range' &&
        c.params.kind === 'positions' &&
        c.params.position_to >= bandIds.length)
    )
      invalid(path, '位置が組数の範囲外です。')
  }
}
