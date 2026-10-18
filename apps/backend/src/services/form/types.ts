export interface FormMember {
  memberId: string
  memberName: string
}

export interface FormRoster {
  eventId: string
  eventTitle: string
  updatedAt: string
  bands: {
    bandId: string
    bandName: string
    description: string | null
    requestText: string | null
  }[]
  members: FormMember[]
  memberships: { bandId: string; memberId: string }[]
}

export interface CreateFormBandInput {
  expectedUpdatedAt: string
  bandName: string
  description?: string | null
  requestText?: string | null
  memberIds: string[]
  newMembers: { memberName: string }[]
}

export interface UpdateFormBandInput {
  expectedUpdatedAt: string
  bandName?: string
  description?: string | null
  requestText?: string | null
  memberIds?: string[]
  newMembers?: { memberName: string }[]
}

export interface FormBandChanges {
  bandId: string
  bandName: string
  description: string | null
  requestText: string | null
  create: boolean
  newMembers: FormMember[]
  // undefined preserves current memberships; [] removes all of them.
  memberIds?: string[]
}

export interface SavedFormBand {
  eventId: string
  updatedAt: string
  band: {
    bandId: string
    bandName: string
    description: string | null
    requestText: string | null
    memberIds: string[]
  }
  members: FormMember[]
}

export interface FormRepository {
  get(eventId: string): Promise<FormRoster | null>
  save(
    eventId: string,
    expectedUpdatedAt: string,
    changes: FormBandChanges,
  ): Promise<{ updatedAt: string }>
}
