import { loadEvent } from '../db/events'
import type { createDb } from '../db/index'
import { saveEvent } from '../db/save-event'
import { EventError } from '../services/events/errors'
import type { SolverRepository, SolverSnapshot } from '../services/solver/types'

type LoadedEvent = NonNullable<Awaited<ReturnType<typeof loadEvent>>>
function snapshot(value: LoadedEvent): SolverSnapshot {
  const { event, bands, members, memberships, parts, placements, constraints } =
    value
  const {
    eventId,
    title,
    status,
    date,
    venue,
    description,
    createdAt,
    updatedAt,
  } = event
  const assigned = new Set(placements.map((row) => row.bandId))
  return {
    event: {
      eventId,
      title,
      status,
      date,
      venue,
      description,
      createdAt,
      updatedAt,
    },
    schedule: {
      eventId,
      updatedAt,
      bands: bands
        .map(({ bandId, bandName, requestText, requestStatus }) => ({
          bandId,
          bandName,
          requestText,
          requestStatus,
        }))
        .sort((a, b) => a.bandId.localeCompare(b.bandId)),
      members: members
        .map(({ memberId, memberName }) => ({
          memberId,
          memberName,
        }))
        .sort((a, b) => a.memberId.localeCompare(b.memberId)),
      memberships: memberships.toSorted(
        (a, b) =>
          a.bandId.localeCompare(b.bandId) ||
          a.memberId.localeCompare(b.memberId),
      ),
      parts: parts.map(({ partId, partName, sortOrder }) => ({
        partId,
        partName,
        sortOrder,
      })),
      placements,
      unassignedBandIds: bands
        .filter((row) => !assigned.has(row.bandId))
        .map((row) => row.bandId)
        .sort(),
    },
    constraints: {
      eventId,
      updatedAt,
      constraints: constraints.map(
        ({ constraintId, constraintJson, sourceBandId }) => ({
          constraintId,
          constraintJson,
          sourceBandId,
        }),
      ),
    },
  }
}

export function solverRepository(
  db: ReturnType<typeof createDb>,
): SolverRepository {
  return {
    async get(userId, eventId) {
      const loaded = await loadEvent(db, userId, eventId)
      return loaded ? snapshot(loaded) : null
    },
    async save(userId, eventId, expectedUpdatedAt, changes) {
      const current = await loadEvent(db, userId, eventId)
      if (!current) throw new EventError('event_not_found')
      if (current.event.updatedAt !== expectedUpdatedAt)
        throw new EventError('event_save_conflict')
      try {
        const saved = await saveEvent(db, userId, eventId, expectedUpdatedAt, {
          ...current.event,
          bands: current.bands,
          members: current.members,
          memberships: current.memberships,
          parts: current.parts,
          placements: changes.placements,
          constraints: changes.constraints.map((constraint) => ({
            constraintId: constraint.constraint_id,
            constraintJson: JSON.stringify(constraint),
          })),
        })
        return snapshot(saved)
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === 'event_save_conflict' ||
            error.message === 'event_not_found')
        )
          throw new EventError(error.message)
        throw error
      }
    },
  }
}
