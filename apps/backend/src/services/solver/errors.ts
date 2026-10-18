const statuses = {
  solver_unavailable: 503,
  solver_upstream_error: 502,
  solver_invalid_response: 502,
  solver_timeout: 504,
} as const
export class SolverError extends Error {
  readonly code: keyof typeof statuses
  constructor(code: keyof typeof statuses) {
    super(code)
    this.code = code
  }
  get status() {
    return statuses[this.code]
  }
}
