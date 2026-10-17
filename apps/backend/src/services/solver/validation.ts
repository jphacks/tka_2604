import { z } from 'zod'

import { validateConstraint } from '../../shared/constraints/schema'
import { SolverError } from './errors'
import { evaluateConstraint, targetBandIds } from './evaluation'
import type { SolveInput, SolverRequest, SolverResult } from './types'

export const solveInputSchema = z.strictObject({
  expectedUpdatedAt: z.iso.datetime(),
  constraints: z
    .array(
      z.custom<NonNullable<SolveInput['constraints']>[number]>((value) =>
        validateConstraint(value),
      ),
    )
    .optional(),
})
const id = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0)
const placement = z.strictObject({
  bandId: id,
  partId: id,
  order: z.number().int().nonnegative(),
})
const diagnostics = z
  .array(
    z.strictObject({
      code: z.string(),
      constraintIds: z.array(id),
      message: z.string(),
    }),
  )
  .optional()
const resultSchema = z.union([
  z.strictObject({
    eventId: id,
    status: z.enum(['optimal', 'feasible', 'partial']),
    placements: z.array(placement),
    unassignedBandIds: z.array(id),
    constraintResults: z.array(
      z.strictObject({
        constraintId: id,
        status: z.enum(['met', 'unmet', 'disabled', 'unchecked']),
      }),
    ),
    diagnostics,
  }),
  z.strictObject({
    eventId: id,
    status: z.enum(['infeasible', 'unknown']),
    placements: z.null(),
    unassignedBandIds: z.null(),
    constraintResults: z.null(),
    diagnostics,
  }),
])
const unique = (values: string[]) =>
  values.every((value) => value.trim().length > 0) &&
  new Set(values).size === values.length

export function validateSolverInput(input: SolverRequest) {
  const fail = (path: string, reason: string): never => {
    throw new SolverError('invalid_input', [{ path, reason }])
  }
  const bandIds = input.bands.map((row) => row.bandId)
  const memberIds = input.members.map((row) => row.memberId)
  const partIds = input.parts.map((row) => row.partId)
  if (!input.bands.length || !input.parts.length)
    fail('/bands', 'バンドと部は各1件以上必要です。')
  for (const [path, values] of [
    ['bands', bandIds],
    ['members', memberIds],
    ['parts', partIds],
    ['constraints', input.constraints.map((row) => row.constraint_id)],
  ] as const)
    if (!unique(values)) fail(`/${path}`, 'IDが空または重複しています。')
  if (input.parts.some((row, index) => row.sortOrder !== index))
    fail('/parts', '部のsortOrderは0から連続で指定してください。')
  if (
    !unique(
      input.memberships.map((row) =>
        JSON.stringify([row.bandId, row.memberId]),
      ),
    ) ||
    input.memberships.some(
      (row) =>
        !bandIds.includes(row.bandId) || !memberIds.includes(row.memberId),
    )
  )
    fail('/memberships', '所属に重複または別イベントの参照があります。')
  if (!validPlacements(input, input.currentPlacements))
    fail('/currentPlacements', '現在配置のID・順序が不正です。')
  input.constraints.forEach((constraint, index) => {
    const path = `/constraints/${index}`
    if (
      !validateConstraint(constraint) ||
      constraint.event_id !== input.eventId ||
      (constraint.hardness === 'hard'
        ? constraint.priority !== null
        : constraint.priority === null)
    )
      fail(path, '制約の形式・イベント・優先度が不正です。')
    if (
      constraint.type === 'before' &&
      constraint.targets.before_band_id === constraint.targets.after_band_id
    )
      fail(path, '前後関係の対象は異なるバンドを指定してください。')
    if (
      constraint.type === 'count' &&
      constraint.params.min > constraint.params.max
    )
      fail(path, 'minはmax以下で指定してください。')
    if (
      constraint.type === 'in_range' &&
      constraint.params.kind === 'positions' &&
      constraint.params.position_from > constraint.params.position_to
    )
      fail(path, '指定範囲が不正です。')
    // Keep disabled JSON intact, but ignore its stale target/part/position references.
    if (!constraint.enabled) return
    if (
      targetBandIds(constraint, input).some((id) => !bandIds.includes(id)) ||
      (constraint.type === 'min_gap_member' &&
        !memberIds.includes(constraint.targets.member_id))
    )
      fail(path, '対象がこのイベントに存在しません。')
    const params = constraint.params
    if (
      'part_ids' in params &&
      params.part_ids.some(
        (value) => !input.parts.some((part) => part.sortOrder === value),
      )
    )
      fail(path, '参照する部が存在しません。')
    if (
      constraint.type === 'at_position' &&
      constraint.params.position >= bandIds.length
    )
      fail(path, '指定位置がバンド数の範囲外です。')
    if (
      constraint.type === 'in_range' &&
      constraint.params.kind === 'positions' &&
      constraint.params.position_to >= bandIds.length
    )
      fail(path, '指定範囲が不正です。')
  })
}

function validPlacements(
  input: SolverRequest,
  placements: SolverRequest['currentPlacements'],
): boolean {
  if (!unique(placements.map((row) => row.bandId))) return false
  if (
    placements.some(
      (row) =>
        !input.bands.some((band) => band.bandId === row.bandId) ||
        !input.parts.some((part) => part.partId === row.partId) ||
        !Number.isInteger(row.order) ||
        row.order < 0,
    )
  )
    return false
  return input.parts.every((part) =>
    placements
      .filter((row) => row.partId === part.partId)
      .toSorted((a, b) => a.order - b.order)
      .every((row, index) => row.order === index),
  )
}

export function validateSolverResult(
  input: SolverRequest,
  value: unknown,
): SolverResult {
  const invalid = (): never => {
    throw new SolverError('solver_invalid_response')
  }
  const parsed = resultSchema.safeParse(value)
  if (!parsed.success) return invalid()
  const result = parsed.data
  if (result.eventId !== input.eventId) return invalid()
  const constraintIds = input.constraints.map((row) => row.constraint_id)
  if (
    result.diagnostics?.some((row) =>
      row.constraintIds.some((id) => !constraintIds.includes(id)),
    )
  )
    return invalid()
  if (result.placements === null) return result
  if (!validPlacements(input, result.placements)) return invalid()
  const allIds = [
    ...result.placements.map((row) => row.bandId),
    ...result.unassignedBandIds,
  ]
  if (
    !unique(allIds) ||
    allIds.length !== input.bands.length ||
    input.bands.some((row) => !allIds.includes(row.bandId))
  )
    return invalid()
  if (
    result.status === 'partial'
      ? !result.placements.length || !result.unassignedBandIds.length
      : result.unassignedBandIds.length !== 0
  )
    return invalid()
  const returnedIds = result.constraintResults.map((row) => row.constraintId)
  if (
    !unique(returnedIds) ||
    returnedIds.length !== constraintIds.length ||
    returnedIds.some((id) => !constraintIds.includes(id))
  )
    return invalid()
  for (const constraint of input.constraints) {
    const evaluated = evaluateConstraint(constraint, input, result.placements)
    if (
      (constraint.hardness === 'hard' && evaluated.violated) ||
      result.constraintResults.find(
        (row) => row.constraintId === constraint.constraint_id,
      )?.status !== evaluated.status
    )
      return invalid()
  }
  return result
}
