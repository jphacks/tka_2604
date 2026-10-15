import { describe, expect, it } from 'vitest'

import { mockEvent } from '../../../mock/eventData'
import { buildConstraint, createConstraintDraft } from './constraintDraft'

describe('structured manual constraint input', () => {
  it('converts human order and between counts to schema positions and differences', () => {
    const draft = {
      ...createConstraintDraft(),
      type: 'at_position' as const,
      bandIds: ['p2'],
      position: '1',
    }
    expect(buildConstraint(draft, mockEvent, 'test')).toMatchObject({
      ok: true,
      constraint: {
        type: 'at_position',
        priority: null,
        targets: { band_id: 'p2' },
        params: { position: 0 },
      },
    })
    expect(
      buildConstraint(
        {
          ...draft,
          type: 'min_gap_member',
          memberId: 'm1',
          between: '2',
          hardness: 'soft',
          priority: 'mid',
        },
        mockEvent,
        'test',
      ),
    ).toMatchObject({
      ok: true,
      constraint: { priority: 'mid', params: { min_diff: 3 } },
    })
  })
  it('round trips all supported parameter variants without losing IDs or enabled state', () => {
    const constraints = [
      ...mockEvent.constraints,
      {
        ...mockEvent.constraints[0],
        type: 'min_gap_bands' as const,
        targets: { band_ids: ['p1', 'p2'] as [string, string] },
        params: { min_diff: 2, same_part_only: true },
      },
      {
        ...mockEvent.constraints[0],
        type: 'before' as const,
        targets: { before_band_id: 'p1', after_band_id: 'p2' },
        params: {},
      },
      {
        ...mockEvent.constraints[0],
        type: 'in_range' as const,
        targets: { band_ids: ['p1'] as [string] },
        params: {
          kind: 'positions' as const,
          position_from: 0,
          position_to: 3,
        },
      },
      {
        ...mockEvent.constraints[0],
        type: 'in_range' as const,
        targets: { band_ids: ['p1'] as [string] },
        params: {
          kind: 'parts' as const,
          part_ids: [0, 1] as [number, ...number[]],
        },
      },
      {
        ...mockEvent.constraints[0],
        type: 'count' as const,
        targets: { band_ids: ['p1'] as [string] },
        params: { scope: 'per_part' as const, min: 0, max: 1 },
      },
      {
        ...mockEvent.constraints[0],
        type: 'count' as const,
        targets: { band_ids: ['p1'] as [string] },
        params: {
          scope: 'in_parts' as const,
          part_ids: [0] as [number],
          min: 0,
          max: 1,
        },
      },
    ]
    for (const original of constraints) {
      const constraint = {
        ...original,
        enabled: false,
        source_text: '希望の原文',
      }
      expect(
        buildConstraint(
          createConstraintDraft(constraint),
          mockEvent,
          constraint.constraint_id,
        ),
      ).toEqual({ ok: true, constraint })
    }
  })
  it('rejects empty and fractional numeric inputs, missing targets and duplicate before targets', () => {
    const draft = createConstraintDraft()
    expect(buildConstraint(draft, mockEvent, 'test').ok).toBe(false)
    for (const between of ['', '1.5', '-1', '0']) {
      expect(
        buildConstraint(
          { ...draft, memberId: 'm1', between },
          mockEvent,
          'test',
        ).ok,
      ).toBe(false)
    }
    expect(
      buildConstraint(
        { ...draft, type: 'before', beforeId: 'p1', afterId: 'p1' },
        mockEvent,
        'test',
      ).ok,
    ).toBe(false)
  })
})
