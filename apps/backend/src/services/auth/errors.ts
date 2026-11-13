type AuthErrorCode =
  'invalid_credentials' | 'user_id_unavailable' | 'rate_limited'
export class AuthError extends Error {
  readonly code: AuthErrorCode
  readonly status: 401 | 409 | 429
  readonly retryAfter?: number
  constructor(
    code: AuthErrorCode,
    status: 401 | 409 | 429,
    retryAfter?: number,
  ) {
    super(code)
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }
}
