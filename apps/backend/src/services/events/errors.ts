export class EventError extends Error {
  readonly code: 'event_not_found' | 'event_save_conflict'

  constructor(code: 'event_not_found' | 'event_save_conflict') {
    super(code)
    this.name = 'EventError'
    this.code = code
  }
}
