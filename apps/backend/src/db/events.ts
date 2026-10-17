import { and, asc, eq, inArray } from 'drizzle-orm'

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

export async function loadEvent(db: Database, userId: string, eventId: string) {
  const [
    eventRows,
    bandRows,
    memberRows,
    membershipRows,
    partRows,
    placementRows,
    constraintRows,
  ] = await db.batch([
    db
      .select()
      .from(events)
      .where(
        and(
          eq(events.eventId, eventId),
          eq(events.createdUserId, userId),
          eq(events.isDeleted, false),
        ),
      ),
    db.select().from(bands).where(eq(bands.eventId, eventId)),
    db.select().from(members).where(eq(members.eventId, eventId)),
    db
      .select()
      .from(bandMembers)
      .where(
        inArray(
          bandMembers.bandId,
          db
            .select({ id: bands.bandId })
            .from(bands)
            .where(eq(bands.eventId, eventId)),
        ),
      ),
    db
      .select()
      .from(parts)
      .where(eq(parts.eventId, eventId))
      .orderBy(asc(parts.sortOrder)),
    db
      .select({
        bandId: bandOrder.bandId,
        partId: bandOrder.partId,
        order: bandOrder.order,
      })
      .from(bandOrder)
      .innerJoin(parts, eq(parts.partId, bandOrder.partId))
      .where(eq(parts.eventId, eventId))
      .orderBy(asc(parts.sortOrder), asc(bandOrder.order)),
    db.select().from(constraints).where(eq(constraints.eventId, eventId)),
  ])
  const event = eventRows[0]
  if (!event) return null
  return {
    event,
    bands: bandRows,
    members: memberRows,
    memberships: membershipRows,
    parts: partRows,
    placements: placementRows,
    constraints: constraintRows,
  }
}

export async function createEvent(
  db: Database,
  userId: string,
  input: Pick<
    typeof events.$inferInsert,
    'title' | 'date' | 'venue' | 'description'
  >,
) {
  const eventId = crypto.randomUUID()
  await db.batch([
    db.insert(events).values({ ...input, eventId, createdUserId: userId }),
    db
      .insert(parts)
      .values({ partId: crypto.randomUUID(), eventId, sortOrder: 0 }),
  ])
  const saved = await loadEvent(db, userId, eventId)
  if (!saved) throw new Error('event_not_found')
  return saved
}

export async function deleteEvent(
  db: Database,
  userId: string,
  eventId: string,
) {
  const deleted = await db
    .update(events)
    .set({ isDeleted: true, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(events.eventId, eventId),
        eq(events.createdUserId, userId),
        eq(events.isDeleted, false),
      ),
    )
    .returning({ eventId: events.eventId })
  if (deleted.length === 0) throw new Error('event_not_found')
}
