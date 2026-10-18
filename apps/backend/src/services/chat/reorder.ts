import type { Constraint } from '../../generated/constraint.ts'
import {
  type SolverClient,
  type SolverRequest,
  solverResultSchema,
} from '../solver/contract.ts'
import { SolverError } from '../solver/errors.ts'
import { evaluate, type Violation } from '../solver/evaluation.ts'
import { AIChatError } from './errors.ts'
import type { AIChatInput, Placement, ReorderResult } from './types.ts'

// A reorder may move placed bands between existing parts, but must keep the
// same set of placed bands, each part's bandCount, and contiguous 0-based
// orders in every part.
export function validateReorder(
  placements: Placement[],
  { context }: AIChatInput,
) {
  const placed = new Set(context.currentPlacements.map((p) => p.bandId))
  const bandIds = new Set(placements.map((p) => p.bandId))
  const capacity = new Map(context.parts.map((p) => [p.partId, p.bandCount]))
  const orders = new Map<string, number[]>()
  for (const p of placements)
    orders.set(p.partId, [...(orders.get(p.partId) ?? []), p.order])
  if (
    bandIds.size !== placements.length ||
    bandIds.size !== placed.size ||
    [...bandIds].some((id) => !placed.has(id)) ||
    [...orders].some(([id, list]) => list.length > (capacity.get(id) ?? -1)) ||
    [...orders.values()].some((list) =>
      list.toSorted((a, b) => a - b).some((order, index) => order !== index),
    )
  )
    throw new AIChatError('ai_chat_invalid_output')
}

export function evaluateReorder(
  placements: Placement[],
  input: AIChatInput,
  source: ReorderResult['source'],
): ReorderResult {
  const { context } = input
  return {
    placements,
    source,
    results: context.constraints.map((constraint) => {
      const after = evaluate(constraint, context, placements)
      return {
        constraintId: constraint.constraint_id,
        hardness: constraint.hardness,
        priority: constraint.priority,
        before: evaluate(constraint, context, context.currentPlacements).status,
        after: after.status,
        violations: after.violations,
        explanations: after.violations.map((v) => explain(v, input)),
      }
    }),
  }
}

export const hasHardViolation = (result: ReorderResult) =>
  result.results.some((r) => r.hardness === 'hard' && r.violations.length)

function globalOrder(placements: Placement[], { context }: AIChatInput) {
  const sortOrder = new Map(context.parts.map((p) => [p.partId, p.sortOrder]))
  return placements
    .toSorted(
      (a, b) =>
        sortOrder.get(a.partId)! - sortOrder.get(b.partId)! ||
        a.order - b.order,
    )
    .map((p) => p.bandId)
}

// Keep each band near the model's position with a low-priority soft window and
// let the Solver find the nearest order satisfying every hard constraint.
// Windows, unlike pairwise "before" anchors, make moving a block far costly. Only placed bands
// take part, so constraints targeting unplaced bands are left out. Returns
// null when the Solver cannot give a complete hard-feasible order.
const FLOW_WINDOW = 1

export async function repairWithSolver(
  placements: Placement[],
  input: AIChatInput,
  eventId: string,
  client: SolverClient,
): Promise<Placement[] | null> {
  const { context } = input
  const placed = new Set(placements.map((p) => p.bandId))
  const memberships = context.memberships.filter((m) => placed.has(m.bandId))
  const targetsPlaced = (c: Constraint) =>
    c.type === 'min_gap_member'
      ? true
      : c.type === 'before'
        ? placed.has(c.targets.before_band_id) &&
          placed.has(c.targets.after_band_id)
        : c.type === 'at_position'
          ? placed.has(c.targets.band_id)
          : c.targets.band_ids.every((id) => placed.has(id))
  const order = globalOrder(placements, input)
  const anchors: Constraint[] = order.map((bandId, position) => ({
    schema_version: '1.0.0',
    constraint_id: `reorder-flow-${position}`,
    event_id: eventId,
    type: 'in_range',
    hardness: 'soft',
    priority: 'low',
    enabled: true,
    targets: { band_ids: [bandId] },
    params: {
      kind: 'positions',
      position_from: Math.max(0, position - FLOW_WINDOW),
      position_to: Math.min(order.length - 1, position + FLOW_WINDOW),
    },
  }))
  const request: SolverRequest = {
    eventId,
    bands: order.map((bandId) => ({ bandId })),
    members: context.members.map(({ memberId }) => ({ memberId })),
    memberships,
    parts: context.parts.map(({ partId, sortOrder, bandCount }) => ({
      partId,
      sortOrder,
      bandCount,
    })),
    constraints: [...context.constraints.filter(targetsPlaced), ...anchors],
    currentPlacements: placements,
  }
  let response: unknown
  try {
    response = await client(request)
  } catch (error) {
    if (error instanceof SolverError) return null
    throw error
  }
  const parsed = solverResultSchema.safeParse(response)
  if (
    !parsed.success ||
    parsed.data.eventId !== eventId ||
    parsed.data.placements === null ||
    parsed.data.status === 'partial'
  )
    return null
  try {
    validateReorder(parsed.data.placements, input)
  } catch {
    return null
  }
  return parsed.data.placements
}

// Display text with band and part names and 1-based overall positions.
function explain(violation: Violation, { context }: AIChatInput) {
  const band = (id: string) =>
    context.bands.find((b) => b.bandId === id)?.bandName ?? id
  const at = (position: number) => `全体の${position + 1}番目`
  const part = (sortOrder: number) =>
    context.parts.find((p) => p.sortOrder === sortOrder)?.partName ??
    `第${sortOrder + 1}部`
  switch (violation.kind) {
    case 'too_close': {
      const [a, b] = violation.bandIds
      const [pa, pb] = violation.positions
      return `${band(a)}（${at(pa)}）と${band(b)}（${at(pb)}）の位置の差が${pb - pa}です（${violation.minDiff}以上が必要）。`
    }
    case 'order': {
      const [pa, pb] = violation.positions
      return `${band(violation.beforeBandId)}（${at(pa)}）が${band(violation.afterBandId)}（${at(pb)}）より前になっていません。`
    }
    case 'out_of_position':
      return `${band(violation.bandId)}が${at(violation.position)}（${part(violation.part)}）にあり、指定された位置・部の外です。`
    case 'count':
      return `${violation.parts.map(part).join('・')}が${violation.count}組です（${violation.min}〜${violation.max}組が必要）。`
  }
}
