import { expect, it } from 'vitest'

import { eventFixture } from '../../../test/fixtures/event'
import { eventReducer, initialState } from './eventReducer'

it('undoes and redoes content without rolling back saved revisions or messages', () => {
  let state = eventReducer(initialState, {
    type: 'loaded',
    event: { ...structuredClone(eventFixture), constraints: [] },
  })
  const id = state.event!.performances[0].id
  const original = state.event!.sections
  state = eventReducer(state, { type: 'order', id, value: null })
  expect(state.past).toHaveLength(1)
  const moved = state.event!.sections
  state = eventReducer(state, { type: 'saved', updatedAt: 'latest' })
  state = eventReducer(state, {
    type: 'message',
    message: { id: 'msg', role: 'assistant', text: 'reply' },
  })
  state = eventReducer(state, { type: 'history', direction: 'undo' })
  expect(state.event!.sections).toEqual(original)
  expect(state.event!.updatedAt).toBe('latest')
  expect(state.event!.messages.at(-1)?.id).toBe('msg')
  state = eventReducer(state, { type: 'history', direction: 'redo' })
  expect(state.event!.sections).toEqual(moved)
  state = eventReducer(state, { type: 'history', direction: 'undo' })
  state = eventReducer(state, { type: 'order', id, value: null })
  expect(state.future).toEqual([])
  state = eventReducer(state, { type: 'loaded', event: state.event! })
  expect(state.past).toEqual([])
})

it('groups constraint operations and ignores rejected moves', () => {
  let state = eventReducer(initialState, {
    type: 'loaded',
    event: structuredClone(eventFixture),
  })
  state = eventReducer(state, {
    type: 'order',
    id: state.event!.performances[0].id,
    value: 9999,
  })
  expect(state.past).toEqual([])
  const original = state.event!.constraints
  state = eventReducer(state, {
    type: 'batch',
    actions: original.map((c) => ({
      type: 'constraint-delete',
      id: c.constraint_id,
    })),
  })
  expect(state.past).toHaveLength(1)
  state = eventReducer(state, { type: 'history', direction: 'undo' })
  expect(state.event!.constraints).toEqual(original)
})
