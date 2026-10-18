export class FormError extends Error {
  readonly code:
    | 'invalid_input'
    | 'event_not_found'
    | 'band_not_found'
    | 'event_save_conflict'
  readonly details: { path: string; reason: string }[]

  constructor(
    code:
      | 'invalid_input'
      | 'event_not_found'
      | 'band_not_found'
      | 'event_save_conflict',
    details: { path: string; reason: string }[] = [],
  ) {
    super(code)
    this.name = 'FormError'
    this.code = code
    this.details = details
  }
}
