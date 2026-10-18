import { z } from 'zod'

import { decodeConstraints } from '../events/constraints'
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

export function validateBandDeletion(snapshot: Snapshot, bandId: string) {
  const rows = decodeConstraints({
    eventId: snapshot.event.eventId,
    updatedAt: snapshot.event.updatedAt,
    constraints: snapshot.constraints,
  }).constraints
  const remaining = snapshot.bands.length - 1
  const blocked = rows.filter(
    ({ constraint: c, sourceBandId }) =>
      sourceBandId === bandId ||
      (c.type !== 'min_gap_member' &&
        Object.values(c.targets).flat().includes(bandId)) ||
      (c.type === 'at_position' && c.params.position >= remaining) ||
      (c.type === 'in_range' &&
        c.params.kind === 'positions' &&
        c.params.position_to >= remaining),
  )
  if (blocked.length)
    throw new BandError(
      'band_constraint_conflict',
      blocked.map(({ constraint }) => ({
        path: `/constraints/${constraint.constraint_id}`,
        reason:
          'このバンドまたは削除後の位置範囲を参照する制約を先に変更・削除してください。',
      })),
    )
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
      validateBandDeletion(snapshot, bandId)
      return repository.remove(userId, snapshot, bandId)
    },
  }
}
