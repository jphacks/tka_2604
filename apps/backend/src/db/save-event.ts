import { and, eq, inArray, notInArray, sql } from 'drizzle-orm'

import { loadEvent } from './events'
import { type createDb } from './index'
import {
  bandMembers,
  bandOrder,
  bands,
  constraints,
  events,
  members,
  parts,
} from './schema'

type Database = ReturnType<typeof createDb>
export interface EventChanges {
  title: string
  status: typeof events.$inferSelect.status
  date: string | null
  venue: string | null
  description: string | null
  bands: Pick<typeof bands.$inferSelect, 'bandId' | 'bandName'>[]
  members: Pick<typeof members.$inferSelect, 'memberId' | 'memberName'>[]
  memberships: (typeof bandMembers.$inferSelect)[]
  parts: Pick<typeof parts.$inferSelect, 'partId' | 'partName'>[]
  placements: (typeof bandOrder.$inferSelect)[]
  constraints: Pick<
    typeof constraints.$inferSelect,
    'constraintId' | 'constraintJson'
  >[]
}

// Each statement stays below D1's 100 bound-parameter limit.
function chunks<T>(values: T[]) {
  const result: T[][] = []
  for (let offset = 0; offset < values.length; offset += 20)
    result.push(values.slice(offset, offset + 20))
  return result
}

function assertUnique(ids: string[]) {
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length)
    throw new Error('invalid_or_duplicate_id')
}

function referencesPart(json: string, order: number) {
  const value: unknown = JSON.parse(json)
  if (typeof value !== 'object' || value === null || !('params' in value))
    return false
  const params = value.params
  return (
    typeof params === 'object' &&
    params !== null &&
    'part_ids' in params &&
    Array.isArray(params.part_ids) &&
    params.part_ids.includes(order)
  )
}

export async function saveEvent(
  db: Database,
  userId: string,
  eventId: string,
  expectedUpdatedAt: string,
  input: EventChanges,
) {
  const current = await loadEvent(db, userId, eventId)
  if (!current) throw new Error('event_not_found')
  if (current.event.updatedAt !== expectedUpdatedAt)
    throw new Error('event_save_conflict')
  if (input.parts.length === 0) throw new Error('at_least_one_part_required')
  const partIds = input.parts.map((part) => part.partId)
  const bandIds = input.bands.map((band) => band.bandId)
  const memberIds = input.members.map((member) => member.memberId)
  for (const ids of [
    partIds,
    bandIds,
    memberIds,
    input.constraints.map((item) => item.constraintId),
  ])
    assertUnique(ids)
  if (current.bands.some((band) => !bandIds.includes(band.bandId)))
    throw new Error('unassign_band_instead_of_deleting')
  if (current.members.some((member) => !memberIds.includes(member.memberId)))
    throw new Error('keep_member_in_roster')
  if (
    input.memberships.some(
      (item) =>
        !bandIds.includes(item.bandId) || !memberIds.includes(item.memberId),
    ) ||
    input.placements.some(
      (item) =>
        !bandIds.includes(item.bandId) || !partIds.includes(item.partId),
    )
  )
    throw new Error('invalid_event_reference')
  const removedParts = current.parts.filter(
    (part) => !partIds.includes(part.partId),
  )
  if (
    removedParts.some((part) =>
      input.constraints.some((constraint) =>
        referencesPart(constraint.constraintJson, part.sortOrder),
      ),
    )
  )
    throw new Error('part_is_referenced_by_constraint')

  // A new token even for saves within the same millisecond (without adding a version column).
  const updatedAt = new Date(
    Math.max(Date.now(), Date.parse(expectedUpdatedAt) + 1),
  ).toISOString()
  const offset =
    Math.max(
      ...current.parts.map((part) => part.sortOrder),
      input.parts.length,
    ) + 1
  const sourceBands = new Map(
    current.constraints.map((item) => [item.constraintId, item.sourceBandId]),
  )
  const eventBands = db
    .select({ id: bands.bandId })
    .from(bands)
    .where(eq(bands.eventId, eventId))
  const eventParts = db
    .select({ id: parts.partId })
    .from(parts)
    .where(eq(parts.eventId, eventId))
  try {
    await db.batch([
      // If another save/deletion wins after our read, fail NOT NULL and roll back this whole batch.
      db
        .update(events)
        .set({
          title: sql`CASE WHEN ${events.updatedAt} = ${expectedUpdatedAt} AND ${events.createdUserId} = ${userId} AND ${events.isDeleted} = 0 THEN ${input.title} ELSE NULL END`,
          status: input.status,
          date: input.date,
          venue: input.venue,
          description: input.description,
          updatedAt,
        })
        .where(eq(events.eventId, eventId)),
      db.delete(bandOrder).where(inArray(bandOrder.partId, eventParts)),
      db.delete(bandMembers).where(inArray(bandMembers.bandId, eventBands)),
      db.delete(constraints).where(eq(constraints.eventId, eventId)),
      db
        .update(parts)
        .set({ sortOrder: sql`${parts.sortOrder} + ${offset}` })
        .where(eq(parts.eventId, eventId)),
      ...chunks(input.bands).map((rows) =>
        db
          .insert(bands)
          .values(
            rows.map(({ bandId, bandName }) => ({ bandId, bandName, eventId })),
          )
          .onConflictDoUpdate({
            target: bands.bandId,
            set: {
              bandName: sql`CASE WHEN ${bands.eventId} = ${eventId} THEN excluded.band_name ELSE NULL END`,
            },
          }),
      ),
      ...chunks(input.members).map((rows) =>
        db
          .insert(members)
          .values(rows.map((row) => ({ ...row, eventId })))
          .onConflictDoUpdate({
            target: members.memberId,
            set: {
              memberName: sql`CASE WHEN ${members.eventId} = ${eventId} THEN excluded.member_name ELSE NULL END`,
            },
          }),
      ),
      ...chunks(
        input.parts.map((part, sortOrder) => ({ ...part, eventId, sortOrder })),
      ).map((rows) =>
        db
          .insert(parts)
          .values(rows)
          .onConflictDoUpdate({
            target: parts.partId,
            set: {
              sortOrder: sql`CASE WHEN ${parts.eventId} = ${eventId} THEN excluded.sort_order ELSE NULL END`,
              partName: sql`excluded.part_name`,
            },
          }),
      ),
      db
        .delete(parts)
        .where(
          and(eq(parts.eventId, eventId), notInArray(parts.partId, partIds)),
        ),
      ...chunks(input.memberships).map((rows) =>
        db.insert(bandMembers).values(rows),
      ),
      ...chunks(input.placements).map((rows) =>
        db.insert(bandOrder).values(rows),
      ),
      ...chunks(input.constraints).map((rows) =>
        db.insert(constraints).values(
          rows.map(({ constraintId, constraintJson }) => ({
            constraintId,
            constraintJson,
            eventId,
            sourceBandId: sourceBands.get(constraintId) ?? null,
          })),
        ),
      ),
    ])
  } catch (error) {
    const latest = await loadEvent(db, userId, eventId)
    if (!latest || latest.event.updatedAt !== expectedUpdatedAt)
      throw new Error('event_save_conflict', { cause: error })
    throw error
  }
  const saved = await loadEvent(db, userId, eventId)
  if (!saved) throw new Error('event_not_found')
  // Do not hand a concurrent writer's snapshot to a subsequent solver invocation.
  if (saved.event.updatedAt !== updatedAt)
    throw new Error('event_save_conflict')
  return saved
}
