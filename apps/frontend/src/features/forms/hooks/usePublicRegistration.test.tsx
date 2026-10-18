import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  type FormRoster,
  RegistrationError,
  type RegistrationRepository,
  type SavedFormBand,
} from '../repositories/types'
import { usePublicRegistration } from './usePublicRegistration'

const roster: FormRoster = {
  eventId: 'event',
  eventTitle: 'ライブ',
  updatedAt: '2026-10-17T00:00:00.000Z',
  bands: [
    { bandId: 'a', bandName: 'A' },
    { bandId: 'b', bandName: 'B' },
  ],
  members: [{ memberId: 'm1', memberName: '田中' }],
  memberships: [
    { bandId: 'a', memberId: 'm1' },
    { bandId: 'b', memberId: 'm1' },
  ],
}
const saved: SavedFormBand = {
  eventId: 'event',
  updatedAt: '2026-10-17T00:01:00.000Z',
  band: { bandId: 'new', bandName: 'New', memberIds: ['m1', 'm2'] },
  members: [
    { memberId: 'm1', memberName: '田中' },
    { memberId: 'm2', memberName: '田中' },
  ],
}
function fixture() {
  const repository = {
    get: vi.fn<RegistrationRepository['get']>().mockResolvedValue(roster),
    create: vi.fn<RegistrationRepository['create']>().mockResolvedValue(saved),
    update: vi.fn<RegistrationRepository['update']>().mockResolvedValue(saved),
  }
  return {
    repository,
    ...renderHook(() => usePublicRegistration('event', repository)),
  }
}
describe('public registration', () => {
  it('validates new registrations, then sends existing and same-name new people in one POST and prevents double submits', async () => {
    const { repository, result } = fixture()
    await waitFor(() => expect(result.current.data).toEqual(roster))
    await act(() => result.current.submit())
    expect(repository.create).not.toHaveBeenCalled()
    act(() => result.current.change({ bandName: 'New', rows: [] }))
    await act(() => result.current.submit())
    expect(repository.create).not.toHaveBeenCalled()
    act(() =>
      result.current.change({
        rows: [
          { key: '1', kind: 'existing', value: 'm1' },
          { key: '2', kind: 'new', value: ' 田中 ' },
        ],
      }),
    )
    await act(async () => {
      await Promise.all([result.current.submit(), result.current.submit()])
    })
    expect(repository.create).toHaveBeenCalledExactlyOnceWith('event', {
      expectedUpdatedAt: roster.updatedAt,
      bandName: 'New',
      memberIds: ['m1'],
      newMembers: [{ memberName: '田中' }],
    })
    expect(repository.update).not.toHaveBeenCalled()
    expect(result.current.submitted?.band.bandId).toBe('new')
  })
  it('uses PATCH for the selected band, clears drafts on mode/band changes, and permits removing everyone', async () => {
    const { repository, result } = fixture()
    await waitFor(() => expect(result.current.data).toEqual(roster))
    act(() => result.current.setMode('update'))
    await act(() => result.current.submit())
    expect(repository.update).not.toHaveBeenCalled()
    act(() => result.current.chooseBand('a'))
    expect(result.current.draft.rows[0].value).toBe('m1')
    act(() => result.current.change({ bandName: 'A編集', rows: [] }))
    act(() => result.current.chooseBand('b'))
    expect(result.current.draft.bandName).toBe('B')
    expect(result.current.draft.rows).toHaveLength(1)
    act(() => result.current.chooseBand('a'))
    act(() => result.current.change({ rows: [] }))
    await act(() => result.current.submit())
    expect(repository.update).toHaveBeenCalledExactlyOnceWith('event', 'a', {
      expectedUpdatedAt: roster.updatedAt,
      bandName: 'A',
      memberIds: [],
      newMembers: [],
    })
    expect(repository.create).not.toHaveBeenCalled()
    act(() => result.current.setMode('create'))
    expect(result.current.draft.bandId).toBe('')
    expect(result.current.draft.bandName).toBe('')
  })
  it('keeps input on conflicts, requires explicit refresh, and retries with the new timestamp', async () => {
    const { repository, result } = fixture()
    repository.create.mockRejectedValueOnce(
      new RegistrationError('event_save_conflict', '競合'),
    )
    await waitFor(() => expect(result.current.data).toEqual(roster))
    act(() =>
      result.current.change({
        bandName: '保持',
        rows: [{ key: '1', kind: 'existing', value: 'm1' }],
      }),
    )
    await act(() => result.current.submit())
    expect(result.current.conflict).toBe(true)
    expect(result.current.draft.bandName).toBe('保持')
    expect(result.current.submitted).toBeNull()
    await act(() => result.current.submit())
    expect(repository.create).toHaveBeenCalledTimes(1)
    repository.get.mockResolvedValue({ ...roster, updatedAt: saved.updatedAt })
    await act(() => result.current.refresh())
    expect(result.current.draft.bandName).toBe('保持')
    await act(() => result.current.submit())
    expect(repository.create.mock.calls[1][1].expectedUpdatedAt).toBe(
      saved.updatedAt,
    )
  })
  it.each([
    'invalid_input',
    'event_not_found',
    'band_not_found',
    'internal_error',
    'network',
  ])('preserves input and never claims success on %s', async (code) => {
    const { repository, result } = fixture()
    repository.create.mockRejectedValueOnce(
      new RegistrationError(code, '保存できません'),
    )
    await waitFor(() => expect(result.current.data).toEqual(roster))
    act(() =>
      result.current.change({
        bandName: '保持',
        rows: [{ key: '1', kind: 'new', value: '佐藤' }],
      }),
    )
    await act(() => result.current.submit())
    expect(result.current.formError).toContain('保存できません')
    expect(result.current.draft.bandName).toBe('保持')
    expect(result.current.submitted).toBeNull()
  })
})
