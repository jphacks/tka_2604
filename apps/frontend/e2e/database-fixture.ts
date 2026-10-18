import type { SavedFormBand } from '../src/features/forms/repositories/types'
import { eventFixture as example } from '../src/test/fixtures/event'
import { expect, test as base } from './fixtures'

export const test = base.extend<{
  databaseEvent: {
    eventId: string
    bandIds: Record<string, string>
    memberIds: Record<string, string>
  }
}>({
  databaseEvent: async ({ request }, use) => {
    const response = await request.post('/api/events', {
      data: { title: example.name },
    })
    expect(response.status()).toBe(201)
    const { eventId, updatedAt: initialRevision } = (await response.json()) as {
      eventId: string
      updatedAt: string
    }
    const url = `/api/events/${eventId}`
    try {
      let updatedAt = initialRevision
      const partIds = Object.fromEntries(
        example.sections.map((part) => [part.id, crypto.randomUUID()]),
      )
      const bandIds: Record<string, string> = {}
      const memberIds: Record<string, string> = {}
      for (const band of example.performances) {
        const existing = band.memberIds.filter((id) => memberIds[id])
        const added = band.memberIds.filter((id) => !memberIds[id])
        const saved = await request.post(`${url}/form/bands`, {
          data: {
            expectedUpdatedAt: updatedAt,
            bandName: band.name,
            memberIds: existing.map((id) => memberIds[id]),
            newMembers: added.map((id) => ({
              memberName: example.members.find((member) => member.id === id)!
                .name,
            })),
          },
        })
        expect(saved.status()).toBe(201)
        const result = (await saved.json()) as SavedFormBand
        updatedAt = result.updatedAt
        bandIds[band.id] = result.band.bandId
        for (const id of added)
          memberIds[id] = result.members.find(
            (member) =>
              member.memberName ===
              example.members.find((item) => item.id === id)!.name,
          )!.memberId
      }
      const schedule = await request.post(`${url}/schedule`, {
        data: {
          expectedUpdatedAt: updatedAt,
          parts: example.sections.map((part) => ({
            partId: partIds[part.id],
            partName: null,
          })),
          placements: example.sections.flatMap((part) =>
            part.slots.map((id, order) => ({
              bandId: bandIds[id!],
              partId: partIds[part.id],
              order,
            })),
          ),
          unassignedBandIds: example.unassigned.map((id) => bandIds[id]),
        },
      })
      expect(schedule.status(), await schedule.text()).toBe(200)
      updatedAt = ((await schedule.json()) as { updatedAt: string }).updatedAt
      const constraints = await request.post(`${url}/constraints`, {
        data: {
          expectedUpdatedAt: updatedAt,
          constraints: example.constraints.map((constraint) => ({
            ...constraint,
            constraint_id: crypto.randomUUID(),
            event_id: eventId,
            ...(constraint.type === 'at_position'
              ? { targets: { band_id: bandIds[constraint.targets.band_id] } }
              : {}),
            ...(constraint.type === 'min_gap_member'
              ? {
                  targets: {
                    member_id: memberIds[constraint.targets.member_id],
                  },
                }
              : {}),
          })),
        },
      })
      expect(constraints.status(), await constraints.text()).toBe(200)
      await use({ eventId, bandIds, memberIds })
    } finally {
      expect((await request.delete(url)).status()).toBe(204)
    }
  },
})
export { expect } from './fixtures'
