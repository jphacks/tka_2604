export type {
  CreateFormBandInput,
  FormRoster,
  SavedFormBand,
  UpdateFormBandInput,
} from '../../../../../backend/src/services/form/types'

import type {
  CreateFormBandInput,
  FormRoster,
  SavedFormBand,
  UpdateFormBandInput,
} from '../../../../../backend/src/services/form/types'

export interface RegistrationRepository {
  get(eventId: string, signal?: AbortSignal): Promise<FormRoster>
  create(eventId: string, input: CreateFormBandInput): Promise<SavedFormBand>
  update(
    eventId: string,
    bandId: string,
    input: UpdateFormBandInput,
  ): Promise<SavedFormBand>
}

export class RegistrationError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
