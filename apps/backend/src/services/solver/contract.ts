import { z } from 'zod'

import type { Constraint } from '../../generated/constraint'
import { placementSchema } from '../scheduling/validation'

export const solveInputSchema = z.strictObject({
  expectedUpdatedAt: z.iso.datetime(),
  parts: z
    .array(
      z.strictObject({
        partId: z.string().min(1),
        bandCount: z.number().int().nonnegative(),
      }),
    )
    .min(1),
})
const diagnostics = z
  .array(
    z.strictObject({
      code: z.string(),
      message: z.string(),
      constraintIds: z.array(z.string().min(1)),
    }),
  )
  .optional()
export const solverResultSchema = z.union([
  z.strictObject({
    eventId: z.string().min(1),
    status: z.enum(['optimal', 'feasible', 'partial']),
    placements: z.array(placementSchema),
    unassignedBandIds: z.array(z.string().min(1)),
    constraintResults: z.array(
      z.strictObject({
        constraintId: z.string().min(1),
        status: z.enum(['met', 'unmet', 'disabled', 'unchecked']),
      }),
    ),
    diagnostics,
  }),
  z.strictObject({
    eventId: z.string().min(1),
    status: z.enum(['infeasible', 'unknown']),
    placements: z.null(),
    unassignedBandIds: z.null(),
    constraintResults: z.null(),
    diagnostics,
  }),
])
export interface SolverRequest {
  eventId: string
  bands: { bandId: string }[]
  members: { memberId: string }[]
  memberships: { bandId: string; memberId: string }[]
  parts: { partId: string; sortOrder: number; bandCount: number }[]
  constraints: Constraint[]
  currentPlacements: z.infer<typeof placementSchema>[]
}
export type SolverResult = z.infer<typeof solverResultSchema>
export type SolverClient = (input: SolverRequest) => Promise<unknown>
