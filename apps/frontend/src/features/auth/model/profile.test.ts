import { expect, it } from 'vitest'

import { avatarInitial } from './profile'

it.each([
  ['alice', 'A'],
  ['Bob', 'B'],
  [' ライブ運営 ', 'ラ'],
  ['👩‍🎤ライブ', '👩‍🎤'],
  ['e\u0301clair', 'E\u0301'],
  ['ßeta', 'S'],
  ['', '?'],
])('uses the first displayed character of %s in uppercase', (name, initial) => {
  expect(avatarInitial(name)).toBe(initial)
})
