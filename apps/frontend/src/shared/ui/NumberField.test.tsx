import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { NumberField } from './NumberField'

it('shows a compact, associated error only on commit and accepts the bounds', async () => {
  const user = userEvent.setup()
  const onCommit = vi.fn()
  render(<NumberField label="組数" value={3} max={20} onCommit={onCommit} />)
  const input = screen.getByRole('textbox', { name: '組数' })
  for (const value of ['21', '1.5', '0', '']) {
    await user.clear(input)
    if (value) await user.type(input, value)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.tab()
    expect(screen.getByRole('alert')).toHaveTextContent(/^1〜20の整数$/)
    expect(input).toHaveAccessibleDescription('1〜20の整数')
    expect(onCommit).not.toHaveBeenCalled()
  }
  await user.click(input)
  await user.keyboard('{Escape}')
  expect(input).toHaveValue('3')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  for (const value of ['1', '20']) {
    await user.clear(input)
    await user.type(input, value)
    await user.keyboard('{Enter}')
    expect(onCommit).toHaveBeenLastCalledWith(Number(value))
  }
})

it('allows empty order values and Escape restores an unfinished draft', async () => {
  const user = userEvent.setup()
  const onCommit = vi.fn()
  render(
    <NumberField
      label="出演順"
      value={2}
      max={12}
      allowEmpty
      onCommit={onCommit}
    />,
  )
  const input = screen.getByRole('textbox', { name: '出演順' })
  await user.clear(input)
  await user.keyboard('{Enter}')
  expect(onCommit).toHaveBeenCalledExactlyOnceWith(null)
  await user.clear(input)
  await user.type(input, '99')
  await user.keyboard('{Escape}')
  expect(input).toHaveValue('2')
  await user.tab()
  expect(onCommit).toHaveBeenCalledOnce()
})
