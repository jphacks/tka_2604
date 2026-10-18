import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import type { Constraint } from '../../../generated/constraint'
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
  await user.click(screen.getByRole('button', { name: '任意' }))
  expect(onUpdate).toHaveBeenCalledWith({ hardness: 'soft' })
  await user.click(screen.getByRole('checkbox'))
  expect(onUpdate).toHaveBeenCalledWith({ enabled: false })
  await user.click(screen.getByRole('button', { name: /まとめて削除/ }))
  expect(onDelete).toHaveBeenCalledWith(views.map((view) => view.constraint))
  await user.click(screen.getByRole('button', { name: '内訳（3人）' }))
  await user.click(screen.getByRole('button', { name: '田中の間隔を編集' }))
  expect(onEdit).toHaveBeenCalledWith(views[1].constraint)
  await user.click(screen.getByRole('button', { name: '佐藤の間隔を削除' }))
  expect(onDelete).toHaveBeenLastCalledWith([views[0].constraint])
})
