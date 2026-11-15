import { describe, expect, it } from 'vitest'

import { evalCases } from '../../../eval/chat/cases.ts'
import { evalInput } from '../../../eval/chat/fixture.ts'
import { buildChatStatistics } from '../../../src/services/chat/statistics.ts'

describe('chat statistics', () => {
  it('counts unique single-part hard targets separately from placement, soft, disabled and multi-part wishes', () => {
    const state = evalCases[0].input
    const result = buildChatStatistics(state.context)
    expect(result.totals).toEqual({
      bands: 12,
      members: 6,
      placedBands: 12,
      unplacedBands: 0,
    })
    expect(result.partFixing).toMatchObject({
      fixedCount: 2,
      unfixedCount: 10,
      fixedBandIds: ['b01', 'b02'],
    })
    expect(result.partFixing.unfixedBandIds).toHaveLength(10)
    expect(result.partFixing.basis.map((c) => c.constraintId)).toEqual([
      'fixed',
      'duplicate',
    ])
  })

  it('does not infer part fixing from placements or absolute position constraints', () => {
    const state = evalInput('test')
    const fixed = state.context.constraints.find(
      (c) => c.type === 'at_position',
    )!
    fixed.hardness = 'hard'
    fixed.priority = null
    const result = buildChatStatistics(state.context)
    expect(result.partFixing.fixedCount).toBe(0)
    expect(result.partFixing.unfixedCount).toBe(12)
  })

  it('keeps unplaced bands separate and counts all bands when none are placed', () => {
    const state = evalInput('test', { unplaced: true })
    const result = buildChatStatistics(state.context)
    expect(result.totals).toMatchObject({ placedBands: 0, unplacedBands: 12 })
    expect(result.partFixing.unfixedCount).toBe(12)
    expect(result.memberAppearances.every((m) => m.gaps.length === 0)).toBe(
      true,
    )
  })

  it('distinguishes configured minimum gap from the current gap and sorts by part order', () => {
    const state = evalInput('test')
    state.context.parts.reverse()
    state.context.currentPlacements.reverse()
    const result = buildChatStatistics(state.context)
    expect(result.gapConditions).toContainEqual(
      expect.objectContaining({
        constraintId: 'c-sato-gap',
        minBandsBetween: 1,
      }),
    )
    expect(
      result.memberAppearances.find((m) => m.memberId === 'm-sato')?.gaps,
    ).toEqual([
      {
        beforeBandId: 'b01',
        afterBandId: 'b04',
        bandsBetween: 2,
        samePart: true,
      },
    ])
  })
})

describe('independent chat evaluation fixtures', () => {
  it('does not leak the count case constraints into other cases or later inputs', () => {
    expect(evalCases[0].input.context.constraints).toHaveLength(7)
    expect(evalCases[1].input.context.constraints).toHaveLength(2)
    expect(evalInput('test').context.constraints).toHaveLength(2)
  })

  it('does not share nested constraints, parts or conversation history', () => {
    const messages = [{ role: 'user' as const, text: 'test' }]
    const first = evalInput('first', { recentMessages: messages })
    first.context.constraints[0].enabled = false
    first.context.parts[0].bandCount = 20
    first.recentMessages[0].text = 'changed'
    const second = evalInput('second', { recentMessages: messages })
    expect(second.context.constraints[0].enabled).toBe(true)
    expect(second.context.parts[0].bandCount).toBe(4)
    expect(second.recentMessages[0].text).toBe('test')
  })
})
