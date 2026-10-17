import { and, count, desc, eq, sql } from 'drizzle-orm'

import { createEvent, deleteEvent } from '../db/events'
import type { createDb } from '../db/index'
import { bandOrder, bands, events, parts } from '../db/schema'
import { EventError } from '../services/events/errors'
import type { EventDetails, EventRepository } from '../services/events/types'

type Database = ReturnType<typeof createDb>

// Keep owner IDs, deletion flags and future DB-only columns out of public DTOs.
const eventFields = {
  eventId: events.eventId,
  title: events.title,
  status: events.status,
  date: events.date,
  venue: events.venue,
  description: events.description,
  createdAt: events.createdAt,
  updatedAt: events.updatedAt,
}

function basicFields(event: EventDetails): EventDetails {
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
  return {
    eventId,
    title,
    status,
    date,
    venue,
    description,
    createdAt,
    updatedAt,
  }
}

export function eventsRepository(db: Database): EventRepository {
  const get: EventRepository['get'] = async (userId, eventId) => {
    const [event] = await db
      .select(eventFields)
      .from(events)
      .where(
        and(
          eq(events.eventId, eventId),
          eq(events.createdUserId, userId),
          eq(events.isDeleted, false),
        ),
      )
    return event ?? null
  }

  return {
    async list(userId) {
      const bandCount = db
        .select({ value: count() })
        .from(bands)
        .where(eq(bands.eventId, events.eventId))
      const placementCount = db
        .select({ value: count() })
        .from(bandOrder)
        .innerJoin(parts, eq(parts.partId, bandOrder.partId))
        .where(eq(parts.eventId, events.eventId))
      const partCount = db
        .select({ value: count() })
        .from(parts)
        .where(eq(parts.eventId, events.eventId))
      const rows = await db
        .select({
          ...eventFields,
          performanceCount: sql<number>`(${bandCount})`.mapWith(Number),
          assignedCount: sql<number>`(${placementCount})`.mapWith(Number),
          partCount: sql<number>`(${partCount})`.mapWith(Number),
        })
        .from(events)
        .where(
          and(eq(events.createdUserId, userId), eq(events.isDeleted, false)),
        )
        .orderBy(desc(events.updatedAt), desc(events.eventId))
      return rows.map((event) => ({ ...event, responseCount: null }))
    },
    get,
    async create(userId, input) {
      return basicFields((await createEvent(db, userId, input)).event)
    },
    async update(userId, eventId, expectedUpdatedAt, patch) {
      const updatedAt = new Date(
        Math.max(Date.now(), Date.parse(expectedUpdatedAt) + 1),
      ).toISOString()
      const [updated] = await db
        .update(events)
        .set({ ...patch, updatedAt })
        .where(
          and(
            eq(events.eventId, eventId),
            eq(events.createdUserId, userId),
            eq(events.isDeleted, false),
            eq(events.updatedAt, expectedUpdatedAt),
          ),
        )
        .returning(eventFields)
      if (updated) return updated
      if (!(await get(userId, eventId))) throw new EventError('event_not_found')
      throw new EventError('event_save_conflict')
    },
    async remove(userId, eventId) {
      try {
        await deleteEvent(db, userId, eventId)
      } catch (error) {
        if (error instanceof Error && error.message === 'event_not_found')
          throw new EventError('event_not_found')
        throw error
      }
    },
  }
}
