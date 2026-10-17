import type { Constraint } from '../../generated/constraint'
import type {
  EventDetails,
  EventSchedule,
  StoredEventConstraints,
} from '../events/types'

export type Placement = EventSchedule['placements'][number]

export interface SolverRequest {
  eventId: string
  parts: { partId: string; sortOrder: number }[]
  bands: { bandId: string }[]
  members: { memberId: string }[]
  memberships: EventSchedule['memberships']
  constraints: Constraint[]
  currentPlacements: Placement[]
}

export type ConstraintResultStatus = 'met' | 'unmet' | 'disabled' | 'unchecked'
export interface SolverDiagnostic {
  code: string
  constraintIds: string[]
  message: string
}
export type SolverResult = {
  eventId: string
  diagnostics?: SolverDiagnostic[]
} & (
  | {
      status: 'optimal' | 'feasible' | 'partial'
      placements: Placement[]
      unassignedBandIds: string[]
      constraintResults: {
        constraintId: string
        status: ConstraintResultStatus
      }[]
    }
  | {
      status: 'infeasible' | 'unknown'
      placements: null
      unassignedBandIds: null
      constraintResults: null
    }
)

export interface SolveInput {
  expectedUpdatedAt: string
  // Omission uses the saved constraints; an array atomically replaces them before solving.
  constraints?: Constraint[]
}
export interface SolveResponse {
  result: SolverResult
  schedule: EventSchedule | null
}
export interface SolverSnapshot {
  event: EventDetails
  schedule: EventSchedule
  constraints: StoredEventConstraints
}
export interface SolverRepository {
  get(userId: string, eventId: string): Promise<SolverSnapshot | null>
  save(
    userId: string,
    eventId: string,
    expectedUpdatedAt: string,
    changes: {
      placements: Placement[]
      constraints: Constraint[]
    },
  ): Promise<SolverSnapshot>
}
export type SolverClient = (input: SolverRequest) => Promise<unknown>
