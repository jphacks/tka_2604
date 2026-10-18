import { z } from 'zod'

import { EventError } from '../events/errors'
import type { Snapshot } from '../scheduling/types'
import { BandError } from './errors'

export const deleteBandSchema = z.strictObject({
  expectedUpdatedAt: z.iso.datetime(),
})
export interface DeletedBand {
  eventId: string
  bandId: string
  updatedAt: string
}
export interface BandRepository {
  load(userId: string, eventId: string): Promise<Snapshot | null>
  remove(
    userId: string,
    snapshot: Snapshot,
    bandId: string,
  ): Promise<DeletedBand>
}

export function bandService(repository: BandRepository, userId: string) {
  return {
    async remove(eventId: string, bandId: string, expectedUpdatedAt: string) {
      const snapshot = await repository.load(userId, eventId)
      if (!snapshot) throw new EventError('event_not_found')
      if (snapshot.event.updatedAt !== expectedUpdatedAt)
        throw new EventError('event_save_conflict')
      if (!snapshot.bands.some((band) => band.bandId === bandId))
        throw new BandError('band_not_found')
      return repository.remove(userId, snapshot, bandId)
    },
  }
}
