import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import type { Constraint } from '../../../generated/constraint'
import type { ConstraintStatus } from '../../../shared/model/constraints'
import { eventFixture } from '../../../test/fixtures/event'
import { ConstraintGroupCard } from './ConstraintGroupCard'

const gap = (id: string, memberId: string): Constraint => ({
  schema_version: '1.0.0',
  constraint_id: id,
  event_id: eventFixture.id,
  type: 'min_gap_member',
  hardness: 'hard',
  priority: null,
  enabled: true,
  targets: { member_id: memberId },
  params: { min_diff: 2, same_part_only: false },
})

it.each<ConstraintStatus>(['met', 'unchecked', 'disabled'])(
  'omits non-violation status from the summary and expanded members: %s',
  async (status) => {
    const user = userEvent.setup()
    render(
      <ConstraintGroupCard
        event={eventFixture}
        views={['m1', 'm2'].map((memberId) => ({
          constraint: {
            ...gap(memberId, memberId),
            enabled: status !== 'disabled',
          },
          status,
        }))}
        onUpdate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    await user.click(
      screen.getByRole('button', {
        name: '2人の出演の間に1組以上空ける（部をまたいで適用）',
      }),
    )
    expect(screen.getByRole('article')).not.toHaveTextContent(
      /すべて達成|未配置|未判定|✓|無効/,
    )
    expect(screen.getByText('佐藤')).toBeVisible()
    expect(screen.getByText('田中')).toBeVisible()
  },
)

it('summarises members, applies bulk changes, and opens each member for editing', async () => {
  const user = userEvent.setup()
  const onUpdate = vi.fn()
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  const views = [
    { constraint: gap('a', 'm1'), status: 'met' as const },
    { constraint: gap('b', 'm2'), status: 'unmet' as const },
    { constraint: gap('c', 'm3'), status: 'met' as const },
  ]
  render(
    <ConstraintGroupCard
      event={eventFixture}
      views={views}
      onUpdate={onUpdate}
      onEdit={onEdit}
      onDelete={onDelete}
    />,
  )
  expect(
    screen.getByRole('heading', {
      name: '3人の出演の間に1組以上空ける（部をまたいで適用）',
    }),
  ).toBeVisible()
  expect(screen.getByText('1人が必須条件に違反')).toBeVisible()
  const toggle = screen.getByRole('button', {
    name: '3人の出演の間に1組以上空ける（部をまたいで適用）',
  })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await user.click(screen.getByRole('button', { name: '任意' }))
  expect(onUpdate).toHaveBeenCalledWith({ hardness: 'soft' })
  await user.click(screen.getByRole('checkbox'))
  expect(onUpdate).toHaveBeenCalledWith({ enabled: false })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await user.click(screen.getByRole('button', { name: /まとめて削除/ }))
  expect(onDelete).toHaveBeenCalledWith(views.map((view) => view.constraint))
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await user.click(screen.getByRole('button', { name: '田中の間隔を編集' }))
  expect(onEdit).toHaveBeenCalledWith(views[1].constraint)
  await user.click(screen.getByRole('button', { name: '佐藤の間隔を削除' }))
  expect(onDelete).toHaveBeenLastCalledWith([views[0].constraint])
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('田中')).toBeNull()
  await user.keyboard('{Enter}')
  expect(screen.getByText('田中')).toBeVisible()
  await user.keyboard(' ')
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await user.click(screen.getByRole('button', { name: '内訳（3人）' }))
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('田中')).toBeVisible()
  await user.click(screen.getByRole('button', { name: '内訳を閉じる' }))
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('田中')).toBeNull()
})

it('groups fixed positions while keeping each band position editable and removable', async () => {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  const onUpdate = vi.fn()
  const constraints: Constraint[] = ['p1', 'p2'].map((bandId, position) => ({
    schema_version: '1.0.0',
    constraint_id: `fixed-${bandId}`,
    event_id: eventFixture.id,
    type: 'at_position',
    hardness: 'hard',
    priority: null,
    enabled: true,
    targets: { band_id: bandId },
    params: { position },
  }))
  render(
    <ConstraintGroupCard
      event={eventFixture}
      views={constraints.map((constraint) => ({ constraint, status: 'met' }))}
      onUpdate={onUpdate}
      onEdit={onEdit}
      onDelete={onDelete}
    />,
  )
  await user.click(
    screen.getByRole('button', { name: '2組の出演順を固定する' }),
  )
  const edits = screen.getAllByRole('button', { name: /の出演順を編集$/ })
  expect(edits).toHaveLength(2)
  await user.click(edits[1])
  expect(onEdit).toHaveBeenCalledWith(constraints[1])
  await user.click(screen.getByRole('checkbox'))
  expect(onUpdate).toHaveBeenCalledWith({ enabled: false })
  await user.click(screen.getByRole('button', { name: /まとめて削除/ }))
  expect(onDelete).toHaveBeenCalledWith(constraints)
})
