import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { mockEvent } from '../../../mock/eventData'
import { ConstraintForm } from './ConstraintForm'

it('guides a person from a condition choice through validation, preview, and a typed constraint', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<ConstraintForm event={mockEvent} onSave={onSave} onClose={onClose} />)
  const dialog = within(screen.getByRole('dialog'))
  await user.click(dialog.getByRole('button', { name: /出演位置を指定する/ }))
  await user.click(dialog.getByRole('button', { name: 'この条件を追加' }))
  expect(dialog.getByRole('alert')).toHaveTextContent('出演枠を選んで')
  expect(onSave).not.toHaveBeenCalled()
  await user.selectOptions(
    dialog.getByRole('combobox', { name: '位置を指定する出演枠' }),
    'p2',
  )
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
      event_id: mockEvent.id,
      hardness: 'soft',
      priority: 'mid',
      params: { position: 0 },
      targets: { band_id: 'p2' },
    }),
  )
  expect(onClose).toHaveBeenCalledOnce()
})
