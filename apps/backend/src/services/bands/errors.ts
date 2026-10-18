type BandErrorCode = 'band_not_found' | 'band_constraint_conflict'
export class BandError extends Error {
  readonly code: BandErrorCode
  readonly details: { path: string; reason: string }[]
  constructor(
    code: BandErrorCode,
    details: { path: string; reason: string }[] = [],
  ) {
    super(code)
    this.name = 'BandError'
    this.code = code
    this.details = details
  }
}
