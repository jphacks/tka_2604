import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import {
  describeConstraint,
  evaluateConstraint,
} from '../../../shared/model/constraints'
import { eventFixture } from '../../../test/fixtures/event'
import { RelatedConstraints } from './RelatedConstraints'

function renderRelated() {
  const controller = {
    event: eventFixture,
    allConstraintViews: eventFixture.constraints.map((constraint) => ({
      constraint,
      text: describeConstraint(constraint, eventFixture),
      ...evaluateConstraint(constraint, eventFixture),
    })),
    processingMessage: undefined,
    updateConstraints: vi.fn(),
    updateConstraint: vi.fn(),
    deleteConstraints: vi.fn(),
    saveConstraint: vi.fn(),
    saveConstraintBatch: vi.fn(),
  }
  render(<RelatedConstraints controller={controller} bandId="p1" />)
  return { user: userEvent.setup(), controller }
}

it('opens the condition choices only after pressing manual add', async () => {
  const { user } = renderRelated()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(
    screen.queryByRole('combobox', { name: '追加する制約の対象' }),
  ).toBeNull()
  await user.click(screen.getByRole('button', { name: '手動追加' }))
  const dialog = screen.getByRole('dialog', { name: '制約を手動追加' })
  expect(
    within(dialog).getByRole('button', { name: /メンバーの出演間隔を空ける/ }),
  ).toBeVisible()
  expect(
    within(dialog).getByRole('button', { name: /出演位置を指定する/ }),
  ).toBeVisible()
})

it('preselects a band member and saves through the batch callback', async () => {
  const { user, controller } = renderRelated()
  await user.click(screen.getByRole('button', { name: '手動追加' }))
  await user.click(
    screen.getByRole('button', { name: /メンバーの出演間隔を空ける/ }),
  )
  expect(within(screen.getByRole('dialog')).getByText(/^佐藤（/)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'この条件を追加' }))
  expect(controller.saveConstraintBatch).toHaveBeenCalledOnce()
  expect(controller.saveConstraintBatch).toHaveBeenCalledWith([
    expect.objectContaining({
      type: 'min_gap_member',
      targets: { member_id: 'm1' },
    }),
  ])
  expect(controller.saveConstraint).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('preselects the band after choosing a type and allows replacing it', async () => {
  const { user, controller } = renderRelated()
  await user.click(screen.getByRole('button', { name: '手動追加' }))
  await user.click(screen.getByRole('button', { name: /出演位置を指定する/ }))
  await user.click(screen.getByRole('button', { name: 'この条件を追加' }))
  expect(screen.getByRole('alert')).toHaveTextContent('位置')
  await user.type(
    screen.getByRole('spinbutton', { name: '出演位置（番）' }),
    '1',
  )
  expect(
    within(screen.getByRole('dialog')).getByText('気分上々↑↑を1番にする'),
  ).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: '位置を指定する出演枠の選択を解除' }),
  )
  await user.type(
    screen.getByRole('combobox', { name: '位置を指定する出演枠' }),
    'Pretender',
  )
  await user.click(screen.getByRole('option', { name: 'Pretender' }))
  await user.click(screen.getByRole('button', { name: 'この条件を追加' }))
  expect(controller.saveConstraintBatch).toHaveBeenCalledWith([
    expect.objectContaining({
      type: 'at_position',
      targets: { band_id: 'p2' },
    }),
  ])
})

it('opens an existing related constraint for editing', async () => {
  const { user } = renderRelated()
  const constraint = eventFixture.constraints[0]
  await user.click(
    screen.getByRole('button', {
      name: `${describeConstraint(constraint, eventFixture)}を編集`,
    }),
  )
  expect(screen.getByRole('dialog', { name: '制約を編集' })).toBeVisible()
})

it.each([
  '指定した出演枠の間隔を空ける',
  '出演できる範囲・部を指定する',
  '出演の前後関係を決める',
])('preselects the related band for %s after choosing again', async (name) => {
  const { user } = renderRelated()
  await user.click(screen.getByRole('button', { name: '手動追加' }))
  await user.click(screen.getByRole('button', { name: /出演位置を指定する/ }))
  await user.click(screen.getByRole('button', { name: '種類を選び直す' }))
  await user.click(screen.getByRole('button', { name: new RegExp(name) }))
  const dialog = within(screen.getByRole('dialog'))
  expect(
    dialog.getByRole('button', {
      name:
        name === '出演の前後関係を決める'
          ? '先に出演する組の選択を解除'
          : '気分上々↑↑の選択を解除',
    }),
  ).toBeVisible()
})

it('allows replacing the preselected member', async () => {
  const { user, controller } = renderRelated()
  await user.click(screen.getByRole('button', { name: '手動追加' }))
  await user.click(
    screen.getByRole('button', { name: /メンバーの出演間隔を空ける/ }),
  )
  await user.click(
    screen.getByRole('button', { name: '対象のメンバーの選択を解除' }),
  )
  await user.type(
    screen.getByRole('combobox', { name: '対象のメンバー' }),
    '田中',
  )
  await user.click(screen.getByRole('option', { name: /^田中（/ }))
  await user.click(screen.getByRole('button', { name: 'この条件を追加' }))
  expect(controller.saveConstraintBatch).toHaveBeenCalledWith([
    expect.objectContaining({ targets: { member_id: 'm2' } }),
  ])
})
