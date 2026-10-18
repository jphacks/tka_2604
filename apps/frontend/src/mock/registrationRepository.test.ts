import { describe, expect, it } from 'vitest'

import { createMockRegistrationRepository } from './registrationRepository'
import { createMockWorkspaceStore } from './workspaceStore'

describe('demo registration repository', () => {
  it('registers same-name people separately, shares the admin store, unlinks members and keeps other memberships', async () => {
    const store = createMockWorkspaceStore()
    const repository = createMockRegistrationRepository(store)
    const initial = await repository.get('spring-live-2026')
    const created = await repository.create(initial.eventId, {
      expectedUpdatedAt: initial.updatedAt,
      bandName: 'デモ追加',
      memberIds: ['m1'],
      newMembers: [{ memberName: '同名' }, { memberName: '同名' }],
    })
    expect(created.band.memberIds).toHaveLength(3)
    expect(new Set(created.band.memberIds).size).toBe(3)
    const event = store.getEvent(initial.eventId)
    expect(event.unassigned).toContain(created.band.bandId)
    expect(store.getRegistration(initial.eventId).submissions).toContainEqual(
      expect.objectContaining({
        source: 'form',
        performanceId: created.band.bandId,
      }),
    )
    const saved = await repository.update(
      initial.eventId,
      created.band.bandId,
      {
        expectedUpdatedAt: created.updatedAt,
        bandName: '更新',
        memberIds: [],
        newMembers: [],
      },
    )
    expect(saved.band.memberIds).toEqual([])
    const after = await repository.get(initial.eventId)
    expect(after.memberships).toEqual(initial.memberships)
    expect(after.members).toEqual(expect.arrayContaining(created.members))
    const readded = await repository.update(
      initial.eventId,
      created.band.bandId,
      { expectedUpdatedAt: after.updatedAt, memberIds: ['m1'], newMembers: [] },
    )
    expect(readded.band.memberIds).toEqual(['m1'])
    expect(store.getEvent(initial.eventId).constraints).toEqual(
      event.constraints,
    )
    expect(store.getEvent(initial.eventId).sections).toEqual(event.sections)
  })
  it('detects admin changes and rejects stale saves, missing events and invalid memberships without mutations', async () => {
    const store = createMockWorkspaceStore()
    const repository = createMockRegistrationRepository(store)
    const roster = await repository.get('spring-live-2026')
    const input = {
      expectedUpdatedAt: roster.updatedAt,
      bandName: '新規',
      memberIds: ['m1'],
      newMembers: [],
    }
    await expect(repository.create('missing', input)).rejects.toThrow(
      'イベントが見つかりません',
    )
    await expect(
      repository.create(roster.eventId, { ...input, memberIds: ['foreign'] }),
    ).rejects.toThrow('メンバーを選んで')
    store.updateDetails(roster.eventId, { name: '管理者による変更' })
    const before = store.getEvent(roster.eventId)
    await expect(
      repository.create(roster.eventId, input),
    ).rejects.toMatchObject({ code: 'event_save_conflict' })
    expect(store.getEvent(roster.eventId)).toEqual(before)
    const fresh = await repository.get(roster.eventId)
    expect(Date.parse(fresh.updatedAt)).toBeGreaterThan(
      Date.parse(roster.updatedAt),
    )
    await expect(
      repository.update(roster.eventId, 'missing', {
        ...input,
        expectedUpdatedAt: fresh.updatedAt,
      }),
    ).rejects.toThrow('バンド')
  })
})
