import { and, eq, exists, sql } from 'drizzle-orm'

import { loadEvent } from '../db/events'
import type { createDb } from '../db/index'
import { bands, constraints, events } from '../db/schema'
import { BandError } from '../services/bands/errors'
import type { BandRepository } from '../services/bands/service'
import { EventError } from '../services/events/errors'

export function bandsRepository(
  db: ReturnType<typeof createDb>,
): BandRepository {
  return {
    load: (userId, eventId) => loadEvent(db, userId, eventId),
    async remove(userId, snapshot, bandId) {
      const { eventId, updatedAt: expected } = snapshot.event
      const updatedAt = new Date(
        Math.max(Date.now(), Date.parse(expected) + 1),
      ).toISOString()
      const target = db
        .select({ bandId: bands.bandId })
        .from(bands)
        .where(and(eq(bands.eventId, eventId), eq(bands.bandId, bandId)))
      try {
        await db.batch([
          // Any changed owner, deletion state, revision or band aborts the entire batch.
          // The NULL branch deliberately violates events.updated_at's NOT NULL constraint.
          db
            .update(events)
            .set({
              updatedAt: sql`CASE WHEN ${events.createdUserId} = ${userId} AND ${events.isDeleted} = 0 AND ${events.updatedAt} = ${expected} AND ${exists(target)} THEN ${updatedAt} ELSE NULL END`,
            })
            .where(eq(events.eventId, eventId)),
          // Delete constraints originating from this band; target-only references remain.
          db.delete(constraints).where(eq(constraints.sourceBandId, bandId)),
          db
            .delete(bands)
            .where(and(eq(bands.bandId, bandId), eq(bands.eventId, eventId))),
        ])
      } catch (error) {
        const current = await loadEvent(db, userId, eventId)
        if (!current) throw new EventError('event_not_found')
        if (current.event.updatedAt !== expected)
          throw new EventError('event_save_conflict')
        if (!current.bands.some((band) => band.bandId === bandId))
          throw new BandError('band_not_found')
        throw error
      }
      return { eventId, bandId, updatedAt }
    },
  }
}
