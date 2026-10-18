import { FormError } from './errors'
import type {
  CreateFormBandInput,
  FormRepository,
  SavedFormBand,
  UpdateFormBandInput,
} from './types'

export function formService(repository: FormRepository) {
  async function get(eventId: string) {
    const roster = await repository.get(eventId)
    if (!roster) throw new FormError('event_not_found')
    return roster
  }

  async function save(
    eventId: string,
    bandId: string | undefined,
    input: UpdateFormBandInput,
  ): Promise<SavedFormBand> {
    const roster = await get(eventId)
    const band = roster.bands.find((item) => item.bandId === bandId)
    if (bandId !== undefined && !band) throw new FormError('band_not_found')
    if (roster.updatedAt !== input.expectedUpdatedAt)
      throw new FormError('event_save_conflict')
    for (const [index, memberId] of (input.memberIds ?? []).entries()) {
      if (!roster.members.some((member) => member.memberId === memberId))
        throw new FormError('invalid_input', [
          {
            path: `/memberIds/${index}`,
            reason: 'このイベントのメンバーを指定してください。',
          },
        ])
    }
    const newMembers = (input.newMembers ?? []).map((member) => ({
      memberId: crypto.randomUUID(),
      memberName: member.memberName,
    }))
    const savedBandId = bandId ?? crypto.randomUUID()
    const memberIds =
      input.memberIds === undefined
        ? roster.memberships
            .filter((item) => item.bandId === savedBandId)
            .map((item) => item.memberId)
        : [...input.memberIds, ...newMembers.map((member) => member.memberId)]
    const bandName = input.bandName ?? band!.bandName
    const description =
      input.description === undefined
        ? (band?.description ?? null)
        : input.description
    const saved = await repository.save(eventId, input.expectedUpdatedAt, {
      bandId: savedBandId,
      bandName,
      description,
      create: bandId === undefined,
      newMembers,
      ...(input.memberIds === undefined ? {} : { memberIds }),
    })
    // Build the response from the validated snapshot and the committed change.
    // A separate reload could return a later request's save instead of this one.
    const selected = new Set(memberIds)
    const people = [...roster.members, ...newMembers]
      .filter((member) => selected.has(member.memberId))
      .sort((a, b) =>
        a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0,
      )
    return {
      eventId,
      updatedAt: saved.updatedAt,
      band: {
        bandId: savedBandId,
        bandName,
        description,
        memberIds: people.map((member) => member.memberId),
      },
      members: people,
    }
  }

  return {
    get,
    create: (eventId: string, input: CreateFormBandInput) =>
      save(eventId, undefined, input),
    update: (eventId: string, bandId: string, input: UpdateFormBandInput) =>
      save(eventId, bandId, input),
  }
}
