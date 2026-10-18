import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'

import { Brand } from './Brand'

it('shows Setly text with favicon image in header brand', () => {
  render(
    <MemoryRouter>
      <Brand />
    </MemoryRouter>,
  )

  const homeLink = screen.getByRole('link', { name: 'Setly ホーム' })
  expect(homeLink).toHaveAttribute('href', '/event')
  expect(screen.getByText('Setly')).toBeVisible()
  expect(screen.getByRole('img', { name: 'Setlyアイコン' })).toHaveAttribute(
    'src',
    '/favicon.svg',
  )
})
