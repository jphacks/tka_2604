import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('increments the counter for each click', async () => {
    const user = userEvent.setup()
    render(<App />)

    const counter = screen.getByRole('button', { name: 'Count is 0' })
    await user.click(counter)
    expect(counter).toHaveAccessibleName('Count is 1')

    await user.click(counter)
    expect(counter).toHaveAccessibleName('Count is 2')
  })
})
