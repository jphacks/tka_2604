import type { EventChanges } from '../../db/save-event'
import { decodeConstraints } from '../events/constraints'
import type { EventSchedule } from '../events/types'
import { SchedulingError } from './errors'
import type {
  ConstraintsInput,
  ScheduleInput,
  SchedulingRepository,
  Snapshot,
} from './types'
import { validateConstraints, validateSchedule } from './validation'

const compareId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function eventChanges(snapshot: Snapshot): EventChanges {
  return {
    ...snapshot.event,
    bands: snapshot.bands,
    members: snapshot.members,
    memberships: snapshot.memberships,
    parts: snapshot.parts,
    placements: snapshot.placements,
    constraints: snapshot.constraints,
  }
}
export function scheduleResponse(s: Snapshot): EventSchedule {
  return {
    eventId: s.event.eventId,
    updatedAt: s.event.updatedAt,
    bands: s.bands
      .toSorted((a, b) => compareId(a.bandId, b.bandId))
      .map(({ bandId, bandName, requestText, requestStatus }) => ({
        bandId,
        bandName,
        requestText,
        requestStatus,
      })),
    members: s.members
      .toSorted((a, b) => compareId(a.memberId, b.memberId))
      .map(({ memberId, memberName }) => ({
        memberId,
        memberName,
      })),
    memberships: s.memberships.toSorted(
      (a, b) =>
        compareId(a.bandId, b.bandId) || compareId(a.memberId, b.memberId),
    ),
    parts: s.parts.map(({ partId, partName, sortOrder }) => ({
      partId,
      partName,
      sortOrder,
    })),
    placements: s.placements,
    unassignedBandIds: s.bands
      .toSorted((a, b) => compareId(a.bandId, b.bandId))
      .filter((b) => !s.placements.some((p) => p.bandId === b.bandId))
      .map((b) => b.bandId),
  }
}
export function constraintsResponse(s: Snapshot) {
  return decodeConstraints({
    eventId: s.event.eventId,
    updatedAt: s.event.updatedAt,
    constraints: s.constraints.toSorted((a, b) =>
      compareId(a.constraintId, b.constraintId),
    ),
  })
}
export function schedulingService(
  repository: SchedulingRepository,
  userId: string,
) {
  async function load(eventId: string, expected: string) {
    const snapshot = await repository.load(userId, eventId)
    if (!snapshot) throw new SchedulingError('event_not_found')
    if (snapshot.event.updatedAt !== expected)
      throw new SchedulingError('event_save_conflict')
    return snapshot
  }
  return {
    async saveSchedule(eventId: string, input: ScheduleInput) {
      const current = await load(eventId, input.expectedUpdatedAt)
      validateSchedule(current, input)
      return scheduleResponse(
        await repository.save(userId, current, {
          ...eventChanges(current),
          parts: input.parts,
          placements: input.placements,
        }),
      )
    },
    async saveConstraints(eventId: string, input: ConstraintsInput) {
      const current = await load(eventId, input.expectedUpdatedAt)
      validateConstraints(current, input.constraints)
      return constraintsResponse(
        await repository.save(userId, current, {
          ...eventChanges(current),
          constraints: input.constraints.map((c) => ({
            constraintId: c.constraint_id,
            constraintJson: JSON.stringify(c),
          })),
        }),
      )
    },
  }
}
