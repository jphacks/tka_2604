import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'

import { createEvent, deleteEvent } from '../db/events'
import type { createDb } from '../db/index'
import {
  bandMembers,
  bandOrder,
  bands,
  chatMessages,
  constraints,
  events,
  members,
  parts,
} from '../db/schema'
import { EventError } from '../services/events/errors'
import type { EventDetails, EventRepository } from '../services/events/types'

type Database = ReturnType<typeof createDb>

// Keep owner IDs, deletion flags and future DB-only columns out of public DTOs.
const eventFields = {
  eventId: events.eventId,
  title: events.title,
  date: events.date,
  venue: events.venue,
  description: events.description,
  createdAt: events.createdAt,
  updatedAt: events.updatedAt,
}

function basicFields(event: EventDetails): EventDetails {
  const { eventId, title, date, venue, description, createdAt, updatedAt } =
    event
  return {
    eventId,
    title,
    date,
    venue,
    description,
    createdAt,
    updatedAt,
  }
}

export function eventsRepository(db: Database): EventRepository {
  function scope(userId: string, eventId: string) {
    const condition = and(
      eq(events.eventId, eventId),
      eq(events.createdUserId, userId),
      eq(events.isDeleted, false),
    )
    return {
      event: db.select(eventFields).from(events).where(condition),
      ids: db.select({ eventId: events.eventId }).from(events).where(condition),
    }
  }
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
    async getSchedule(userId, eventId) {
      const owned = scope(userId, eventId)
      const [
        eventRows,
        bandRows,
        memberRows,
        membershipRows,
        partRows,
        placementRows,
      ] = await db.batch([
        owned.event,
        db
          .select({
            bandId: bands.bandId,
            bandName: bands.bandName,
            description: bands.description,
            requestText: bands.requestText,
            requestStatus: bands.requestStatus,
          })
          .from(bands)
          .where(inArray(bands.eventId, owned.ids))
          .orderBy(asc(bands.bandId)),
        db
          .select({
            memberId: members.memberId,
            memberName: members.memberName,
          })
          .from(members)
          .where(inArray(members.eventId, owned.ids))
          .orderBy(asc(members.memberId)),
        db
          .select({
            bandId: bandMembers.bandId,
            memberId: bandMembers.memberId,
          })
          .from(bandMembers)
          .innerJoin(bands, eq(bands.bandId, bandMembers.bandId))
          .innerJoin(members, eq(members.memberId, bandMembers.memberId))
          .where(
            and(
              inArray(bands.eventId, owned.ids),
              eq(members.eventId, eventId),
            ),
          )
          .orderBy(asc(bandMembers.bandId), asc(bandMembers.memberId)),
        db
          .select({
            partId: parts.partId,
            partName: parts.partName,
            bandCount: parts.bandCount,
            sortOrder: parts.sortOrder,
          })
          .from(parts)
          .where(inArray(parts.eventId, owned.ids))
          .orderBy(asc(parts.sortOrder)),
        db
          .select({
            bandId: bandOrder.bandId,
            partId: bandOrder.partId,
            order: bandOrder.order,
          })
          .from(bandOrder)
          .innerJoin(parts, eq(parts.partId, bandOrder.partId))
          .innerJoin(bands, eq(bands.bandId, bandOrder.bandId))
          .where(
            and(inArray(parts.eventId, owned.ids), eq(bands.eventId, eventId)),
          )
          .orderBy(asc(parts.sortOrder), asc(bandOrder.order)),
      ])
      const event = eventRows[0]
      if (!event) return null
      const assigned = new Set(placementRows.map((row) => row.bandId))
      return {
        eventId,
        updatedAt: event.updatedAt,
        bands: bandRows,
        members: memberRows,
        memberships: membershipRows,
        parts: partRows,
        placements: placementRows,
        unassignedBandIds: bandRows
          .filter((row) => !assigned.has(row.bandId))
          .map((row) => row.bandId),
      }
    },
    async getConstraints(userId, eventId) {
      const owned = scope(userId, eventId)
      const [eventRows, rows] = await db.batch([
        owned.event,
        db
          .select({
            constraintId: constraints.constraintId,
            constraintJson: constraints.constraintJson,
            sourceBandId: constraints.sourceBandId,
          })
          .from(constraints)
          .where(inArray(constraints.eventId, owned.ids))
          .orderBy(asc(constraints.constraintId)),
      ])
      const event = eventRows[0]
      return event
        ? { eventId, updatedAt: event.updatedAt, constraints: rows }
        : null
    },
    async getChat(userId, eventId) {
      const owned = scope(userId, eventId)
      const [eventRows, rows] = await db.batch([
        owned.event,
        db
          .select({
            messageId: chatMessages.messageId,
            seq: chatMessages.seq,
            role: chatMessages.role,
            text: chatMessages.text,
            replyToMessageId: chatMessages.replyToMessageId,
            createdAt: chatMessages.createdAt,
          })
          .from(chatMessages)
          .where(inArray(chatMessages.eventId, owned.ids))
          .orderBy(asc(chatMessages.seq)),
      ])
      return eventRows[0] ? { eventId, messages: rows } : null
    },
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
