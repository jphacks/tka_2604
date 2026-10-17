export type SolverErrorCode =
  | 'invalid_input'
  | 'solver_unavailable'
  | 'solver_timeout'
  | 'solver_upstream_error'
  | 'solver_invalid_response'

export class SolverError extends Error {
  readonly code: SolverErrorCode
  readonly details: { path: string; reason: string }[]
  constructor(
    code: SolverErrorCode,
    details: { path: string; reason: string }[] = [],
  ) {
    super(code)
    this.code = code
    this.details = details
  }
}
