export class SchedulingError extends Error {
  readonly code: 'invalid_input' | 'event_not_found' | 'event_save_conflict'
  readonly details: { path: string; reason: string }[]
  constructor(
    code: SchedulingError['code'],
    details: { path: string; reason: string }[] = [],
  ) {
    super(code)
    this.code = code
    this.details = details
  }
}

export function invalid(path: string, reason: string): never {
  throw new SchedulingError('invalid_input', [{ path, reason }])
}
