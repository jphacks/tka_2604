import validate from '../../generated/constraint-validator.cjs'
import type { EventConstraints, StoredEventConstraints } from './types'

export function decodeConstraints(
  stored: StoredEventConstraints,
): EventConstraints {
  return {
    eventId: stored.eventId,
    updatedAt: stored.updatedAt,
    constraints: stored.constraints.map((row) => {
      const value: unknown = JSON.parse(row.constraintJson)
      if (
        !validate(value) ||
        value.constraint_id !== row.constraintId ||
        value.event_id !== stored.eventId ||
        (value.hardness === 'hard'
          ? value.priority !== null
          : value.priority === null)
      )
        throw new Error('invalid_stored_constraint')
      return { constraint: value, sourceBandId: row.sourceBandId }
    }),
  }
}
