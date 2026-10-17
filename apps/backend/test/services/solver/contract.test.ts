import { expect, it } from 'vitest'

import examples from '../../../../schema/examples/solver-contract.json'
import type { SolverRequest } from '../../../src/services/solver/types'
import {
  solveInputSchema,
  validateSolverInput,
  validateSolverResult,
} from '../../../src/services/solver/validation'

it.each(examples.cases)(
  'accepts the shared #20 / #27 $response.status example',
  (example) => {
    const constraints = solveInputSchema.parse({
      expectedUpdatedAt: '2026-10-17T00:00:00.000Z',
      constraints: example.constraints ?? examples.request.constraints,
    }).constraints!
    const request: SolverRequest = { ...examples.request, constraints }
    expect(() => validateSolverInput(request)).not.toThrow()
    expect(validateSolverResult(request, example.response)).toEqual(
      example.response,
    )
  },
)
