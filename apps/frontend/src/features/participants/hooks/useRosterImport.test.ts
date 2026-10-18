import { expect, it } from 'vitest'

import { workspaceRepository } from '../../../shared/repositories/workspaceRepository'
import { importRoster } from './useRosterImport'

it('registers each row, reusing registered people and people created in earlier rows', async () => {
  const eventId = 'spring-live-2026'
  const before = (await workspaceRepository.getRegistration(eventId)).data
  const existing = before.members[0]
  const progress: number[] = []

  await importRoster(
    eventId,
    [
      { line: 2, name: '取込A', members: [existing.name, '取込さん'] },
      { line: 3, name: '取込B', members: ['取込さん', '別の人'] },
    ],
    (done) => progress.push(done),
  )

  const after = (await workspaceRepository.getRegistration(eventId)).data
  const added = after.performances.slice(before.performances.length)
  const shared = after.members.filter((member) => member.name === '取込さん')
  expect(added.map((performance) => performance.name)).toEqual([
    '取込A',
    '取込B',
  ])
  expect(shared).toHaveLength(1)
  expect(added[0].memberIds).toEqual([existing.id, shared[0].id])
  expect(added[1].memberIds).toContain(shared[0].id)
  expect(after.members).toHaveLength(before.members.length + 2)
  expect(progress).toEqual([1, 2])
})
