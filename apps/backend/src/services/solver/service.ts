import type { z } from 'zod'

import { invalid, SchedulingError } from '../scheduling/errors'
import {
  constraintsResponse,
  eventChanges,
  scheduleResponse,
} from '../scheduling/service'
import type { SchedulingRepository, Snapshot } from '../scheduling/types'
import {
  unique,
  validateConstraints,
  validateSchedule,
} from '../scheduling/validation'
import {
  type solveInputSchema,
  type SolverClient,
  type SolverRequest,
  solverResultSchema,
} from './contract'
import { SolverError } from './errors'
import { evaluate } from './evaluation'

function validateResult(
  snapshot: Snapshot,
  input: SolverRequest,
  value: unknown,
) {
  const fail = (): never => {
    throw new SolverError('solver_invalid_response')
  }
  const parsed = solverResultSchema.safeParse(value)
  if (!parsed.success) return fail()
  const result = parsed.data
  const ids = input.constraints.map((c) => c.constraint_id)
  if (
    result.eventId !== input.eventId ||
    result.diagnostics?.some((d) =>
      d.constraintIds.some((id) => !ids.includes(id)),
    )
  )
    return fail()
  if (result.placements === null) return result
  try {
    validateSchedule(snapshot, {
      expectedUpdatedAt: snapshot.event.updatedAt,
      parts: snapshot.parts,
      placements: result.placements,
      unassignedBandIds: result.unassignedBandIds,
    })
  } catch {
    return fail()
  }
  if (
    result.status === 'partial'
      ? !result.placements.length || !result.unassignedBandIds.length
      : result.unassignedBandIds.length !== 0
  )
    return fail()
  const returnedIds = result.constraintResults.map((c) => c.constraintId)
  if (
    !unique(returnedIds) ||
    returnedIds.length !== ids.length ||
    returnedIds.some((id) => !ids.includes(id))
  )
    return fail()
  for (const constraint of input.constraints) {
    const evaluated = evaluate(constraint, input, result.placements)
    if (
      (constraint.hardness === 'hard' && evaluated.violated) ||
      result.constraintResults.find(
        (c) => c.constraintId === constraint.constraint_id,
      )?.status !== evaluated.status
    )
      return fail()
  }
  return result
}

export function solverService(
  repository: SchedulingRepository,
  userId: string,
  client: SolverClient,
) {
  return async (eventId: string, request: z.infer<typeof solveInputSchema>) => {
    const { expectedUpdatedAt, parts } = request
    const snapshot = await repository.load(userId, eventId)
    if (!snapshot) throw new SchedulingError('event_not_found')
    if (snapshot.event.updatedAt !== expectedUpdatedAt)
      throw new SchedulingError('event_save_conflict')
    if (!snapshot.bands.length || !snapshot.parts.length)
      invalid('/bands', '計算にはバンドと部が各1件以上必要です。')
    const constraints = constraintsResponse(snapshot).constraints.map(
      (row) => row.constraint,
    )
    validateConstraints(snapshot, constraints)
    validateSchedule(snapshot, {
      expectedUpdatedAt,
      parts: snapshot.parts,
      placements: snapshot.placements,
      unassignedBandIds: scheduleResponse(snapshot).unassignedBandIds,
    })
    if (snapshot.parts.some((part, index) => part.sortOrder !== index))
      invalid('/parts', '部のsortOrderは0から連続である必要があります。')
    const bandCounts = new Map(
      parts.map(({ partId, bandCount }) => [partId, bandCount]),
    )
    if (
      bandCounts.size !== parts.length ||
      parts.length !== snapshot.parts.length ||
      snapshot.parts.some(({ partId }) => !bandCounts.has(partId))
    )
      invalid('/parts', '保存済みの全ての部を重複なく指定してください。')
    const input: SolverRequest = {
      eventId,
      bands: snapshot.bands.map(({ bandId }) => ({ bandId })),
      members: snapshot.members.map(({ memberId }) => ({ memberId })),
      memberships: snapshot.memberships,
      parts: snapshot.parts.map(({ partId, sortOrder }) => ({
        partId,
        sortOrder,
        bandCount: bandCounts.get(partId)!,
      })),
      constraints,
      // Vacant display slots are not bands; Solver hints use dense band ranks.
      currentPlacements: snapshot.parts.flatMap((part) =>
        snapshot.placements
          .filter((row) => row.partId === part.partId)
          .toSorted((a, b) => a.order - b.order)
          .map((row, order) => ({ ...row, order })),
      ),
    }
    const result = validateResult(snapshot, input, await client(input))
    if (result.placements === null) return { result, schedule: null }
    try {
      const saved = await repository.save(userId, snapshot, {
        ...eventChanges(snapshot),
        placements: result.placements,
      })
      return { result, schedule: scheduleResponse(saved) }
    } catch (error) {
      if (error instanceof SchedulingError && error.code === 'event_not_found')
        throw new SchedulingError('event_save_conflict')
      throw error
    }
  }
}
