import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'

import { eventFixture } from '../../../test/fixtures/event'
import { emptyConstraintFilters } from '../model/constraintFilters'
import { ConstraintFilters } from './ConstraintFilters'

function FiltersExample() {
  const [constraintFilters, setConstraintFilters] = useState({
    ...emptyConstraintFilters,
  })
  const [showUnmet, setShowUnmet] = useState(false)
  return (
    <ConstraintFilters
      controller={{
        event: eventFixture,
        constraintFilters,
        setConstraintFilters,
        constraintViews: [],
        showUnmet,
        setShowUnmet,
        unmetCount: 2,
      }}
    />
  )
}

it('opens detailed filters from the bar and removes a chip without changing the others', async () => {
  const user = userEvent.setup()
  render(<FiltersExample />)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(
    screen.getByRole('region', { name: '選択中のフィルター' }),
  ).toBeVisible()
  expect(screen.queryByText('すべて表示')).toBeNull()
  const opener = screen.getByRole('button', { name: 'フィルターを追加' })
  await user.click(opener)
  const dialog = screen.getByRole('dialog', { name: '制約の絞り込み' })
  await user.type(
    within(dialog).getByRole('textbox', { name: '制約を検索' }),
    '佐藤',
  )
  await user.selectOptions(
    within(dialog).getByRole('combobox', { name: '制約の達成状況で絞り込み' }),
    'unchecked',
  )
  await user.click(within(dialog).getByRole('button', { name: '完了' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(opener).toHaveFocus()
  await user.click(screen.getByRole('button', { name: '状況: 未判定を解除' }))
  expect(
    screen.queryByRole('button', { name: '状況: 未判定を解除' }),
  ).toBeNull()
  expect(screen.getByRole('button', { name: '検索: 佐藤を解除' })).toBeVisible()
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.click(opener)
  expect(
    screen.getByRole('combobox', { name: '制約の達成状況で絞り込み' }),
  ).toHaveValue('')
  expect(screen.getByRole('textbox', { name: '制約を検索' })).toHaveValue(
    '佐藤',
  )
})

it('clears the unmet-only chip and resets all filter types from the dialog', async () => {
  const user = userEvent.setup()
  render(<FiltersExample />)
  const opener = screen.getByRole('button', { name: 'フィルターを設定' })
  await user.click(opener)
  await user.selectOptions(
    screen.getByRole('combobox', { name: '制約の種類で絞り込み' }),
    'min_gap_member',
  )
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'バンドで絞り込み' }),
    'p1',
  )
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'メンバーで絞り込み' }),
    'm1',
  )
  await user.click(screen.getByRole('button', { name: /未達成のみ/ }))
  await user.click(screen.getByRole('button', { name: '完了' }))
  await user.click(screen.getByRole('button', { name: '未達成のみを解除' }))
  expect(screen.queryByRole('button', { name: '未達成のみを解除' })).toBeNull()
  expect(
    screen.getByRole('button', { name: 'バンド: 気分上々↑↑を解除' }),
  ).toBeVisible()
  await user.click(opener)
  await user.click(screen.getByRole('button', { name: '絞り込みを解除' }))
  for (const select of screen.getAllByRole('combobox'))
    expect(select).toHaveValue('')
  expect(screen.getByRole('button', { name: /未達成のみ/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await user.click(screen.getByRole('button', { name: '完了' }))
  expect(
    within(
      screen.getByRole('group', { name: '制約フィルター' }),
    ).queryAllByRole('button', { name: /を解除$/ }),
  ).toHaveLength(0)
})
