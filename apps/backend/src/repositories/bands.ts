import { and, eq, exists, sql } from 'drizzle-orm'

import { loadEvent } from '../db/events'
import type { createDb } from '../db/index'
import { bandOrder, bands, events } from '../db/schema'
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
      const partId = snapshot.placements.find(
        (row) => row.bandId === bandId,
      )?.partId
      const remaining = snapshot.placements
        .filter((row) => row.partId === partId && row.bandId !== bandId)
        .toSorted((a, b) => a.order - b.order)
        .map((row, order) => ({ ...row, order }))
      const batches = Array.from(
        { length: Math.ceil(remaining.length / 20) },
        (_, i) => remaining.slice(i * 20, (i + 1) * 20),
      )
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
          db
            .delete(bands)
            .where(and(eq(bands.bandId, bandId), eq(bands.eventId, eventId))),
          ...(partId
            ? [
                db.delete(bandOrder).where(eq(bandOrder.partId, partId)),
                ...batches.map((rows) => db.insert(bandOrder).values(rows)),
              ]
            : []),
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
