import { expect, it } from 'vitest'

import { loginDestination } from './navigation'

it('restores an event URL after demo login and rejects non-event destinations', () => {
  expect(loginDestination({ returnTo: '/event/spring-live-2026' })).toBe(
    '/event/spring-live-2026',
  )
  expect(
    loginDestination({ returnTo: '/event/spring-live-2026/forms/edit' }),
  ).toBe('/event/spring-live-2026/forms/edit')
  for (const state of [
    null,
    {},
    { returnTo: 'https://example.com' },
    { returnTo: '//example.com' },
    { returnTo: '/eventually' },
  ])
    expect(loginDestination(state)).toBe('/event')
})
