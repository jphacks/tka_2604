import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { eventFixture } from '../../../test/fixtures/event'
import {
  buildRecommendedGapConstraints,
  missingGapMemberIds,
} from '../model/constraintDraft'
import { ConstraintForm } from './ConstraintForm'

it('guides a person from a condition choice through validation, preview, and a typed constraint', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(
    <ConstraintForm event={eventFixture} onSave={onSave} onClose={onClose} />,
  )
  const dialog = within(screen.getByRole('dialog'))
  await user.click(dialog.getByRole('button', { name: /出演位置を指定する/ }))
  await user.click(dialog.getByRole('button', { name: 'この条件を追加' }))
  expect(dialog.getByRole('alert')).toHaveTextContent('出演枠を選んで')
  expect(onSave).not.toHaveBeenCalled()
  await user.type(
    dialog.getByRole('combobox', { name: '位置を指定する出演枠' }),
    'Pret',
  )
  await user.click(dialog.getByRole('option', { name: 'Pretender' }))
  await user.type(
    dialog.getByRole('spinbutton', { name: '出演位置（番）' }),
    '1',
  )
  expect(dialog.getByText('Pretenderを1番にする')).toBeVisible()
  await user.click(dialog.getByRole('button', { name: '任意' }))
  await user.selectOptions(
    dialog.getByRole('combobox', { name: '追加する制約の優先度' }),
    'mid',
  )
  await user.click(dialog.getByRole('button', { name: 'この条件を追加' }))
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'at_position',
      event_id: eventFixture.id,
      hardness: 'soft',
      priority: 'mid',
      params: { position: 0 },
      targets: { band_id: 'p2' },
    }),
  )
  expect(onClose).toHaveBeenCalledOnce()
})

it('adds the recommended member gap after confirmation, and adds nothing on cancel', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const onClose = vi.fn()
  const missing = missingGapMemberIds(eventFixture).length
  render(
    <ConstraintForm event={eventFixture} onSave={onSave} onClose={onClose} />,
  )
  const dialog = within(screen.getByRole('dialog'))
  const recommended = dialog.getByRole('button', {
    name: /掛け持ちの人が連続しないようにする/,
  })
  await user.click(recommended)
  expect(dialog.getByText(new RegExp(`掛け持ちの${missing}人`))).toBeVisible()
  await user.click(dialog.getByRole('button', { name: 'キャンセル' }))
  expect(onSave).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
  await user.click(
    dialog.getByRole('button', { name: /掛け持ちの人が連続しないようにする/ }),
  )
  await user.click(dialog.getByRole('button', { name: `${missing}件を追加` }))
  expect(onSave).toHaveBeenCalledTimes(missing)
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'min_gap_member',
      hardness: 'hard',
      params: { min_diff: 2, same_part_only: false },
    }),
  )
  expect(onClose).toHaveBeenCalledOnce()
})

it('shows the recommendation as already added when every member has a gap', () => {
  const event = {
    ...eventFixture,
    constraints: [
      ...eventFixture.constraints,
      ...buildRecommendedGapConstraints(eventFixture, () =>
        crypto.randomUUID(),
      ),
    ],
  }
  render(<ConstraintForm event={event} onSave={vi.fn()} onClose={vi.fn()} />)
  const recommended = within(screen.getByRole('dialog')).getByRole('button', {
    name: /掛け持ちの人が連続しないようにする/,
  })
  expect(recommended).toBeDisabled()
  expect(recommended).toHaveTextContent('追加済み')
})
