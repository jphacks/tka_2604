import { and, inArray, ne } from 'drizzle-orm'

import { loadEvent } from '../db/events'
import type { createDb } from '../db/index'
import { saveEvent } from '../db/save-event'
import { constraints, parts } from '../db/schema'
import { invalid, SchedulingError } from '../services/scheduling/errors'
import type { SchedulingRepository } from '../services/scheduling/types'

export function schedulingRepository(
  db: ReturnType<typeof createDb>,
): SchedulingRepository {
  return {
    load: (userId, eventId) => loadEvent(db, userId, eventId),
    async save(userId, snapshot, changes) {
      const eventId = snapshot.event.eventId
      for (const [table, column, ids, path] of [
        [parts, parts.partId, changes.parts.map((p) => p.partId), '/parts'],
        [
          constraints,
          constraints.constraintId,
          changes.constraints.map((c) => c.constraintId),
          '/constraints',
        ],
      ] as const) {
        if (ids.length) {
          for (let start = 0; start < ids.length; start += 80) {
            const foreign = await db
              .select({ eventId: table.eventId })
              .from(table)
              .where(
                and(
                  inArray(column, ids.slice(start, start + 80)),
                  ne(table.eventId, eventId),
                ),
              )
              .limit(1)
            if (foreign.length)
              invalid(path, '別イベントで使用されているIDです。')
          }
        }
      }
      try {
        return await saveEvent(
          db,
          userId,
          eventId,
          snapshot.event.updatedAt,
          changes,
        )
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === 'event_not_found' ||
            error.message === 'event_save_conflict')
        )
          throw new SchedulingError(error.message)
        throw error
      }
    },
  }
}
