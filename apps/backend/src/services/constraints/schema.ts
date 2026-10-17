import { z } from 'zod'

import type { Constraint } from '../../generated/constraint.ts'
import { validateConstraint } from '../../shared/constraints/schema.ts'

export {
  constraintJsonSchema,
  type JsonSchema,
} from '../../shared/constraints/schema.ts'

// The event and chat services share canonical shape validation. Completed chat
// context also requires the hardness/priority relation enforced during storage.
export const constraintSchema = z.custom<Constraint>(
  (value) =>
    validateConstraint(value) &&
    (value.hardness === 'hard'
      ? value.priority === null
      : value.priority !== null),
)
