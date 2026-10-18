import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'

import { eventFixture } from '../../../test/fixtures/event'
import { PerformanceDetailsDialog } from './PerformanceDetailsDialog'

afterEach(() => vi.unstubAllGlobals())

function renderDetails(unavailable = false) {
  const user = userEvent.setup()
  const onDelete = vi.fn()
  const onClose = vi.fn()
  const onSaved = vi.fn()
  render(
    <MemoryRouter>
      <PerformanceDetailsDialog
        event={eventFixture}
        performance={{ ...eventFixture.performances[0], fixed: true }}
        position={1}
        unavailable={unavailable}
        deleting={false}
        error=""
        onSaved={onSaved}
        onDelete={onDelete}
        onRefresh={vi.fn()}
        onClose={onClose}
      />
    </MemoryRouter>,
  )
  return { user, onDelete, onClose, onSaved }
}

it('shows band details and opens editing in the same dialog', async () => {
  const roster = {
    eventId: eventFixture.id,
    eventTitle: eventFixture.name,
    updatedAt: 'v1',
    bands: [{ bandId: 'p1', bandName: '気分上々↑↑', description: null }],
    members: eventFixture.members.map((member) => ({
      memberId: member.id,
      memberName: member.name,
    })),
    memberships: ['m1', 'm2', 'm3', 'm4'].map((memberId) => ({
      bandId: 'p1',
      memberId,
    })),
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(roster)))
  const { user } = renderDetails()
  const dialog = within(screen.getByRole('dialog', { name: '気分上々↑↑' }))
  expect(dialog.getByText('1番')).toBeVisible()
  expect(dialog.getByText('佐藤・田中・鈴木・高橋')).toBeVisible()
  expect(
    dialog.getByText('この出演枠は現在の位置に固定されています。'),
  ).toBeVisible()
  await user.click(dialog.getByRole('button', { name: '編集' }))
  expect(
    await screen.findByRole('dialog', { name: '出演枠を編集' }),
  ).toBeVisible()
  await waitFor(() =>
    expect(screen.getByPlaceholderText('例：サンセット・レコード')).toHaveValue(
      '気分上々↑↑',
    ),
  )
  expect(
    screen.queryByRole('combobox', { name: '更新するバンド' }),
  ).not.toBeInTheDocument()
})

it('requires a second confirmation before deleting and allows cancellation', async () => {
  const { user, onDelete, onClose } = renderDetails()
  const dialog = within(screen.getByRole('dialog', { name: '気分上々↑↑' }))
  await user.click(dialog.getByRole('button', { name: '削除' }))
  expect(
    screen.getByRole('dialog', { name: '出演枠の削除' }),
  ).toHaveTextContent('この出演枠の希望から作られた制約だけを削除')
  await user.click(screen.getByRole('button', { name: '戻る' }))
  expect(onDelete).not.toHaveBeenCalled()
  await user.click(dialog.getByRole('button', { name: '削除' }))
  await user.click(screen.getByRole('button', { name: '削除する' }))
  expect(onDelete).toHaveBeenCalledOnce()
  expect(onClose).not.toHaveBeenCalled()
})

it('disables edit and delete while the schedule has unsaved changes', () => {
  const { onDelete } = renderDetails(true)
  const dialog = within(screen.getByRole('dialog', { name: '気分上々↑↑' }))
  expect(
    dialog.getByText('未保存の変更を保存してから編集・削除できます。'),
  ).toBeVisible()
  expect(dialog.getByRole('button', { name: '削除' })).toBeDisabled()
  expect(dialog.getByRole('button', { name: '編集' })).toBeDisabled()
  expect(onDelete).not.toHaveBeenCalled()
})
