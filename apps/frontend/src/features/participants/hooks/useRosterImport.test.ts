import { beforeEach, expect, it, vi } from 'vitest'

import type {
  CreateFormBandInput,
  SavedFormBand,
} from '../../forms/repositories/types'

const api = vi.hoisted(() => ({
  create:
    vi.fn<
      (eventId: string, input: CreateFormBandInput) => Promise<SavedFormBand>
    >(),
}))
vi.mock('../../forms/repositories/registrationRepository', () => ({
  registrationRepository: api,
}))
import { parseRosterCsv, type RosterRow } from '../model/rosterCsv'
import { importRoster } from './useRosterImport'

const rows = (
  parseRosterCsv(
    '曲名,紹介,メンバー1,メンバー2\n曲A,メタル,佐藤,田中\n曲B,,田中,鈴木\n',
  ) as { rows: RosterRow[] }
).rows

// Echo the request as the saved band, issuing IDs for new people.
function saveEcho() {
  let count = 0
  api.create.mockImplementation(
    (_eventId: string, input: CreateFormBandInput): Promise<SavedFormBand> => {
      count += 1
      const created = input.newMembers.map((member, index) => ({
        memberId: `new-${count}-${index}`,
        memberName: member.memberName,
      }))
      return Promise.resolve({
        eventId: 'e',
        updatedAt: `2026-10-18T00:00:0${count}.000Z`,
        band: {
          bandId: `b${count}`,
          bandName: input.bandName,
          description: input.description ?? null,
          requestText: null,
          memberIds: [...input.memberIds, ...created.map((m) => m.memberId)],
        },
        members: [
          ...input.memberIds.map((memberId) => ({
            memberId,
            memberName: '佐藤',
          })),
          ...created,
        ],
      })
    },
  )
}

beforeEach(() => {
  api.create.mockReset()
})

it('registers each row in order, chaining the event token and reusing new people', async () => {
  saveEcho()
  const progress = vi.fn()
  await importRoster(
    'e',
    rows,
    [{ id: 'm-sato', name: '佐藤' }],
    '2026-10-18T00:00:00.000Z',
    progress,
  )
  expect(api.create.mock.calls.map(([, input]) => input)).toEqual([
    {
      expectedUpdatedAt: '2026-10-18T00:00:00.000Z',
      bandName: '曲A',
      description: 'メタル',
      memberIds: ['m-sato'],
      newMembers: [{ memberName: '田中' }],
    },
    {
      expectedUpdatedAt: '2026-10-18T00:00:01.000Z',
      bandName: '曲B',
      description: null,
      memberIds: ['new-1-0'],
      newMembers: [{ memberName: '鈴木' }],
    },
  ])
  expect(progress.mock.calls).toEqual([[1], [2]])
})

it('stops with the failing line and how many bands were already saved', async () => {
  saveEcho()
  api.create
    .mockImplementationOnce(api.create.getMockImplementation()!)
    .mockRejectedValueOnce(new Error('イベントが更新されました。'))
  await expect(
    importRoster('e', rows, [], '2026-10-18T00:00:00.000Z'),
  ).rejects.toThrow(
    '3行目「曲B」で止まりました（1組は登録済み）。イベントが更新されました。',
  )
})

it('refuses a name shared by several registered people', async () => {
  await expect(
    importRoster(
      'e',
      rows,
      [
        { id: 'a', name: '佐藤' },
        { id: 'b', name: '佐藤' },
      ],
      '2026-10-18T00:00:00.000Z',
    ),
  ).rejects.toThrow('「佐藤」は同名の登録済みメンバーが複数います。')
  expect(api.create).not.toHaveBeenCalled()
})
