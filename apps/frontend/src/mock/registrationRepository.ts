import { registrationInput } from '../features/forms/model/registration'
import {
  type CreateFormBandInput,
  type FormRoster,
  RegistrationError,
  type RegistrationRepository,
  type SavedFormBand,
  type UpdateFormBandInput,
} from '../features/forms/repositories/types'
import { delay } from './delay'
import {
  type createMockWorkspaceStore,
  mockWorkspaceStore,
} from './workspaceStore'

export function createMockRegistrationRepository(
  store: ReturnType<typeof createMockWorkspaceStore> = mockWorkspaceStore,
): RegistrationRepository {
  const versions = new Map<string, { snapshot: string; updatedAt: string }>()
  function roster(eventId: string): FormRoster {
    const event = store.getEvent(eventId)
    const snapshot = JSON.stringify({ ...event, messages: undefined })
    let version = versions.get(eventId)
    if (!version || version.snapshot !== snapshot) {
      const previousTime = version ? Date.parse(version.updatedAt) : 0
      version = {
        snapshot,
        updatedAt: new Date(
          Math.max(Date.now(), previousTime + 1),
        ).toISOString(),
      }
      versions.set(eventId, version)
    }
    return {
      eventId,
      eventTitle: event.name,
      updatedAt: version.updatedAt,
      bands: event.performances.map((band) => ({
        bandId: band.id,
        bandName: band.name,
      })),
      members: event.members.map((member) => ({
        memberId: member.id,
        memberName: member.name,
      })),
      memberships: event.performances.flatMap((band) =>
        band.memberIds.map((memberId) => ({ bandId: band.id, memberId })),
      ),
    }
  }
  function save(
    eventId: string,
    bandId: string | null,
    input: CreateFormBandInput | UpdateFormBandInput,
  ): SavedFormBand {
    const current = roster(eventId)
    if (input.expectedUpdatedAt !== current.updatedAt)
      throw new RegistrationError(
        'event_save_conflict',
        '別の変更が保存されています。名簿を再取得してください。',
      )
    const existing = current.bands.find((band) => band.bandId === bandId)
    if (bandId && !existing) throw new Error('更新するバンドが見つかりません。')
    if ((input.memberIds === undefined) !== (input.newMembers === undefined))
      throw new Error('所属メンバーを指定してください。')
    const checked = registrationInput(
      bandId ? 'update' : 'create',
      {
        bandId: bandId ?? '',
        bandName: input.bandName ?? existing?.bandName ?? '',
        rows: [
          ...(
            input.memberIds ??
            current.memberships
              .filter((item) => item.bandId === bandId)
              .map((item) => item.memberId)
          ).map((value) => ({ key: value, kind: 'existing' as const, value })),
          ...(input.newMembers ?? []).map((member) => ({
            key: crypto.randomUUID(),
            kind: 'new' as const,
            value: member.memberName,
          })),
        ],
      },
      current,
    )
    const id = store.saveFormBand(eventId, bandId, {
      name: checked.bandName,
      memberIds: checked.memberIds,
      newMembers: checked.newMembers.map((member) => ({
        id: crypto.randomUUID(),
        name: member.memberName,
      })),
    })
    const next = roster(eventId)
    const band = next.bands.find((band) => band.bandId === id)!
    const memberIds = next.memberships
      .filter((item) => item.bandId === id)
      .map((item) => item.memberId)
    return {
      eventId,
      updatedAt: next.updatedAt,
      band: { ...band, memberIds },
      members: next.members.filter((member) =>
        memberIds.includes(member.memberId),
      ),
    }
  }
  return {
    async get(eventId, signal) {
      await delay(0, signal)
      return roster(eventId)
    },
    async create(eventId, input) {
      await delay(0)
      return save(eventId, null, input)
    },
    async update(eventId, bandId, input) {
      await delay(0)
      return save(eventId, bandId, input)
    },
  }
}
export const mockRegistrationRepository = createMockRegistrationRepository()
