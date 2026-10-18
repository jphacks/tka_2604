import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'

import { eventFixture } from '../../../test/fixtures/event'
import {
  ALL_MULTI_MEMBERS,
  type ConstraintDraft,
  createConstraintDraft,
} from '../model/constraintDraft'
import { ConstraintFields } from './ConstraintFields'

function Harness({ type }: { type: ConstraintDraft['type'] }) {
  const [draft, setDraft] = useState({ ...createConstraintDraft(), type })
  return (
    <>
      <ConstraintFields
        event={eventFixture}
        draft={draft}
        allowAllMembers
        change={(patch) => setDraft((value) => ({ ...value, ...patch }))}
      />
      <output aria-label="対象ID">
        {[draft.memberId, draft.beforeId, draft.afterId, ...draft.bandIds]
          .filter(Boolean)
          .join(',')}
      </output>
    </>
  )
}

it('selects all shared members with a separate checkbox and returns to individual selection', async () => {
  const user = userEvent.setup()
  render(<Harness type="min_gap_member" />)
  await user.type(
    screen.getByRole('combobox', { name: '対象のメンバー' }),
    '佐藤',
  )
  await user.keyboard('{ArrowDown}{Enter}')
  expect(screen.getByLabelText('対象ID')).toHaveTextContent('m1')
  await user.click(
    screen.getByRole('button', { name: '対象のメンバーの選択を解除' }),
  )
  await user.click(screen.getByRole('combobox'))
  expect(
    screen.queryByRole('option', { name: /掛け持ちの全員/ }),
  ).not.toBeInTheDocument()
  const checkbox = screen.getByRole('checkbox', { name: /掛け持ちの全員/ })
  await user.click(checkbox)
  expect(checkbox).toBeChecked()
  expect(screen.getByLabelText('対象ID')).toHaveTextContent(ALL_MULTI_MEMBERS)
  expect(
    screen.getByRole('combobox', { name: '対象のメンバー' }),
  ).toBeDisabled()
  await user.click(checkbox)
  expect(checkbox).not.toBeChecked()
  expect(screen.getByLabelText('対象ID')).toBeEmptyDOMElement()
  const input = screen.getByRole('combobox', { name: '対象のメンバー' })
  expect(input).toBeEnabled()
  await user.clear(input)
  await user.type(input, '田中{ArrowDown}{Enter}')
  expect(screen.getByLabelText('対象ID')).toHaveTextContent('m2')
})

it('selects before and after performances by name while rejecting unregistered text', async () => {
  const user = userEvent.setup()
  render(<Harness type="before" />)
  const before = screen.getByRole('combobox', { name: '先に出演する組' })
  await user.type(before, '未登録{Enter}')
  expect(screen.getByLabelText('対象ID')).toBeEmptyDOMElement()
  await user.clear(before)
  await user.type(before, 'pret')
  await user.click(screen.getByRole('option', { name: 'Pretender' }))
  await user.type(
    screen.getByRole('combobox', { name: '後に出演する組' }),
    '青と夏{ArrowDown}{Enter}',
  )
  expect(screen.getByLabelText('対象ID')).toHaveTextContent('p2,p4')
})

it('adds distinct performances to a multiple selection and removes chips', async () => {
  const user = userEvent.setup()
  render(<Harness type="min_gap_bands" />)
  const input = screen.getByRole('combobox', { name: '対象の出演枠を検索' })
  await user.type(input, 'Pret{ArrowDown}{Enter}')
  await user.type(input, 'VPS{ArrowDown}{Enter}')
  expect(screen.getByLabelText('対象ID')).toHaveTextContent('p2,p3')
  await user.click(input)
  expect(
    screen.queryByRole('option', { name: 'Pretender' }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Pretenderの選択を解除' }),
  )
  expect(screen.getByLabelText('対象ID')).toHaveTextContent('p3')
  expect(input).toHaveFocus()
})
