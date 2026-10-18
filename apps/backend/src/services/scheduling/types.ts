import type { z } from 'zod'

import type { loadEvent } from '../../db/events'
import type { EventChanges } from '../../db/save-event'
import type { saveConstraintsSchema, saveScheduleSchema } from './validation'

export type Snapshot = NonNullable<Awaited<ReturnType<typeof loadEvent>>>
export type ScheduleInput = z.infer<typeof saveScheduleSchema>
export type ConstraintsInput = z.infer<typeof saveConstraintsSchema>
export interface SchedulingRepository {
  load(userId: string, eventId: string): Promise<Snapshot | null>
  save(
    userId: string,
    snapshot: Snapshot,
    changes: EventChanges,
  ): Promise<Snapshot>
}
