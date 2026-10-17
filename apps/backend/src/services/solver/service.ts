import { decodeConstraints } from '../events/constraints'
import { EventError } from '../events/errors'
import type {
  SolveInput,
  SolverClient,
  SolveResponse,
  SolverRepository,
  SolverRequest,
  SolverSnapshot,
} from './types'
import { validateSolverInput, validateSolverResult } from './validation'

function solverInput(snapshot: SolverSnapshot): SolverRequest {
  const schedule = snapshot.schedule
  return {
    eventId: schedule.eventId,
    parts: schedule.parts.map(({ partId, sortOrder }) => ({
      partId,
      sortOrder,
    })),
    bands: schedule.bands.map(({ bandId }) => ({ bandId })),
    members: schedule.members.map(({ memberId }) => ({ memberId })),
    memberships: schedule.memberships,
    constraints: decodeConstraints(snapshot.constraints).constraints.map(
      (row) => row.constraint,
    ),
    currentPlacements: schedule.placements,
  }
}

// Shared by the execution button and explicit generation requests in chat (#29 / #47).
export function solveService(
  repository: SolverRepository,
  solve: SolverClient,
  userId: string,
) {
  return {
    async execute(eventId: string, input: SolveInput): Promise<SolveResponse> {
      let snapshot = await repository.get(userId, eventId)
      if (!snapshot) throw new EventError('event_not_found')
      if (snapshot.event.updatedAt !== input.expectedUpdatedAt)
        throw new EventError('event_save_conflict')
      let request = solverInput(snapshot)
      if (input.constraints !== undefined)
        request.constraints = input.constraints
      validateSolverInput(request)
      if (input.constraints !== undefined) {
        snapshot = await repository.save(
          userId,
          eventId,
          snapshot.event.updatedAt,
          {
            constraints: input.constraints,
            placements: snapshot.schedule.placements,
          },
        )
        request = solverInput(snapshot)
        validateSolverInput(request)
      }
      const result = validateSolverResult(request, await solve(request))
      if (result.placements === null) return { result, schedule: null }
      const saved = await repository.save(
        userId,
        eventId,
        snapshot.event.updatedAt,
        {
          constraints: request.constraints,
          placements: result.placements,
        },
      )
      return { result, schedule: saved.schedule }
    },
  }
}
