import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { Panel } from './Panel'

it('disables controls while the panel is inert', () => {
  const { rerender } = render(
    <Panel title="出演順" inert>
      <button>編集</button>
    </Panel>,
  )
  expect(
    screen.getByRole('region', { name: '出演順' }).getAttribute('aria-busy'),
  ).toBe('true')
  expect(screen.getByText('編集').closest('[inert]')).not.toBeNull()
  rerender(
    <Panel title="出演順">
      <button>編集</button>
    </Panel>,
  )
  expect(
    screen.getByRole('region', { name: '出演順' }).getAttribute('aria-busy'),
  ).toBe('false')
  expect(screen.getByText('編集').closest('[inert]')).toBeNull()
})

it('marks the panel busy without adding a separate processing message', () => {
  render(
    <Panel title="出演順" busy>
      <button>編集</button>
    </Panel>,
  )
  expect(screen.getByRole('region', { name: '出演順' })).toHaveAttribute(
    'aria-busy',
    'true',
  )
  expect(screen.queryByRole('status')).toBeNull()
})
