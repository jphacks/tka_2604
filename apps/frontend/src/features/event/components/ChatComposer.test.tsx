import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { ChatComposer } from './ChatComposer'

it('grows to six rows while focused and collapses to two without losing text', () => {
  const submit = vi.fn()
  render(
    <ChatComposer
      value={'long\ntext'}
      onChange={vi.fn()}
      onSubmit={submit}
      disabled={false}
      active
    />,
  )
  const input = screen.getByRole('textbox')
  Object.defineProperty(input, 'scrollHeight', { value: 240 })
  fireEvent.focus(input)
  expect(input).toHaveStyle({ height: '144px' })
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true, isComposing: true })
  expect(submit).not.toHaveBeenCalled()
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
  expect(submit).toHaveBeenCalledTimes(1)
  fireEvent.blur(input)
  expect(input).toHaveStyle({ height: '48px' })
  expect(input).toHaveValue('long\ntext')
})
