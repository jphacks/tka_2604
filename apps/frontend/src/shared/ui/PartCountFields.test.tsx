import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'

import { PartCountFields } from './PartCountFields'

function Harness({ initial }: { initial: number[] }) {
  const [counts, setCounts] = useState(initial)
  return <PartCountFields counts={counts} onChange={setCounts} />
}

it('changes the part count with the step buttons, keeping existing band counts', async () => {
  const user = userEvent.setup()
  render(<Harness initial={[6]} />)
  const parts = screen.getByRole('spinbutton', { name: '部数' })
  const fewer = screen.getByRole('button', { name: '部数を減らす' })
  const more = screen.getByRole('button', { name: '部数を増やす' })
  expect(fewer).toBeDisabled()

  await user.click(more)
  await user.click(more)
  expect(parts).toHaveValue(3)
  expect(screen.getByRole('spinbutton', { name: '第1部の組数' })).toHaveValue(6)
  expect(screen.getByRole('spinbutton', { name: '第3部の組数' })).toHaveValue(4)

  await user.click(fewer)
  expect(parts).toHaveValue(2)
  expect(
    screen.queryByRole('spinbutton', { name: '第3部の組数' }),
  ).not.toBeInTheDocument()
})

it('stops at eight parts and does not step when the label is clicked', async () => {
  const user = userEvent.setup()
  render(<Harness initial={[4, 4, 4, 4, 4, 4, 4, 4]} />)
  expect(screen.getByRole('button', { name: '部数を増やす' })).toBeDisabled()
  await user.click(screen.getByText('部数'))
  expect(screen.getByRole('spinbutton', { name: '部数' })).toHaveValue(8)
})
