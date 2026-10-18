import { and, asc, eq, exists, inArray, sql } from 'drizzle-orm'

import type { createDb } from '../db/index'
import { bandMembers, bands, events, members } from '../db/schema'
import { FormError } from '../services/form/errors'
import type { FormRepository } from '../services/form/types'

export function formRepository(
  db: ReturnType<typeof createDb>,
): FormRepository {
  const active = (eventId: string) =>
    and(eq(events.eventId, eventId), eq(events.isDeleted, false))
  const bandScope = (eventId: string, bandId: string) =>
    and(eq(bands.eventId, eventId), eq(bands.bandId, bandId))
  return {
    async get(eventId) {
      const ids = db
        .select({ eventId: events.eventId })
        .from(events)
        .where(active(eventId))
      const [eventRows, bandRows, memberRows, membershipRows] = await db.batch([
        db
          .select({
            eventId: events.eventId,
            eventTitle: events.title,
            updatedAt: events.updatedAt,
          })
          .from(events)
          .where(active(eventId)),
        db
          .select({
            bandId: bands.bandId,
            bandName: bands.bandName,
            description: bands.description,
          })
          .from(bands)
          .where(inArray(bands.eventId, ids))
          .orderBy(asc(bands.bandId)),
        db
          .select({
            memberId: members.memberId,
            memberName: members.memberName,
          })
          .from(members)
          .where(inArray(members.eventId, ids))
          .orderBy(asc(members.memberId)),
        db
          .select({
            bandId: bandMembers.bandId,
            memberId: bandMembers.memberId,
          })
          .from(bandMembers)
          .innerJoin(bands, eq(bands.bandId, bandMembers.bandId))
          .innerJoin(members, eq(members.memberId, bandMembers.memberId))
          .where(and(inArray(bands.eventId, ids), eq(members.eventId, eventId)))
          .orderBy(asc(bandMembers.bandId), asc(bandMembers.memberId)),
      ])
      if (!eventRows[0]) return null
      return {
        ...eventRows[0],
        bands: bandRows,
        members: memberRows,
        memberships: membershipRows,
      }
    },
    async save(eventId, expectedUpdatedAt, changes) {
      const updatedAt = new Date(
        Math.max(Date.now(), Date.parse(expectedUpdatedAt) + 1),
      ).toISOString()
      const bandExists = db
        .select({ bandId: bands.bandId })
        .from(bands)
        .where(bandScope(eventId, changes.bandId))
      const validBand = changes.create ? sql`1` : exists(bandExists)
      try {
        await db.batch([
          // NOT NULL turns a stale/deleted/invalid target into a failed statement,
          // aborting the entire batch, including new members and membership changes.
          db
            .update(events)
            .set({
              updatedAt: sql`CASE WHEN ${events.updatedAt} = ${expectedUpdatedAt} AND ${events.isDeleted} = 0 AND ${validBand} THEN ${updatedAt} ELSE NULL END`,
            })
            .where(eq(events.eventId, eventId)),
          ...(changes.create
            ? [
                db.insert(bands).values({
                  eventId,
                  bandId: changes.bandId,
                  bandName: changes.bandName,
                  description: changes.description,
                }),
              ]
            : [
                db
                  .update(bands)
                  .set({
                    bandName: changes.bandName,
                    description: changes.description,
                  })
                  .where(bandScope(eventId, changes.bandId)),
              ]),
          ...(changes.newMembers.length
            ? [
                db.insert(members).values(
                  changes.newMembers.map((member) => ({
                    ...member,
                    eventId,
                  })),
                ),
              ]
            : []),
          ...(changes.memberIds === undefined
            ? []
            : [
                db
                  .delete(bandMembers)
                  .where(eq(bandMembers.bandId, changes.bandId)),
                ...(changes.memberIds.length
                  ? [
                      db.insert(bandMembers).values(
                        changes.memberIds.map((memberId) => ({
                          bandId: changes.bandId,
                          memberId,
                        })),
                      ),
                    ]
                  : []),
              ]),
        ])
      } catch (error) {
        const current = await db
          .select({ updatedAt: events.updatedAt })
          .from(events)
          .where(active(eventId))
          .get()
        if (!current) throw new FormError('event_not_found')
        if (current.updatedAt !== expectedUpdatedAt)
          throw new FormError('event_save_conflict')
        if (!changes.create && !(await bandExists.get()))
          throw new FormError('band_not_found')
        throw error
      }
      return { updatedAt }
    },
  }
}
