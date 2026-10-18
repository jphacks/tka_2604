import { expect, it } from 'vitest'

import { resizeColumns } from './useColumnResize'

const widths = { constraints: 300, chat: 320 }

it('widens the constraints column when dragging the first handle left', () => {
  expect(resizeColumns(widths, 'constraints', -40, 1600)).toEqual({
    constraints: 340,
    chat: 320,
  })
})

it('moves width between constraints and chat with the second handle', () => {
  expect(resizeColumns(widths, 'chat', -40, 1600)).toEqual({
    constraints: 260,
    chat: 360,
  })
})

it('keeps every column at its minimum width', () => {
  expect(resizeColumns(widths, 'constraints', 200, 1600).constraints).toBe(240)
  expect(resizeColumns(widths, 'chat', 200, 1600)).toEqual({
    constraints: 380,
    chat: 240,
  })
  expect(resizeColumns(widths, 'chat', -200, 1600)).toEqual({
    constraints: 240,
    chat: 380,
  })
})

it('keeps the schedule column wide enough to use', () => {
  expect(resizeColumns(widths, 'constraints', -2000, 1400)).toEqual({
    constraints: 600,
    chat: 320,
  })
})
