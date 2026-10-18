import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'

import { openApiDocument } from '../../../src/openapi'
import {
  aiChatOutputJsonSchema,
  aiChatOutputSchema,
  proposedConstraintSchema,
} from '../../../src/services/chat/contract.ts'
import type { ProposedConstraint } from '../../../src/services/chat/types.ts'
import { constraintSchema } from '../../../src/services/constraints/schema.ts'
import { approval } from './fixtures.ts'

const constraints: ProposedConstraint[] = [
  {
    type: 'min_gap_member',
    targets: { member_id: 'member-1' },
    params: { min_diff: 2, same_part_only: false },
    hardness: null,
    priority: null,
  },
  {
    type: 'min_gap_bands',
    targets: { band_ids: ['band-a', 'band-b'] },
    params: { min_diff: 2, same_part_only: false },
    hardness: null,
    priority: null,
  },
  {
    type: 'before',
    targets: { before_band_id: 'band-a', after_band_id: 'band-b' },
    params: {},
    hardness: null,
    priority: null,
  },
  {
    type: 'at_position',
    targets: { band_id: 'band-a' },
    params: { position: 0 },
    hardness: null,
    priority: null,
  },
  {
    type: 'in_range',
    targets: { band_ids: ['band-a'] },
    params: { kind: 'parts', part_ids: [1] },
    hardness: null,
    priority: null,
  },
  {
    type: 'in_range',
    targets: { band_ids: ['band-a'] },
    params: { kind: 'positions', position_from: 0, position_to: 1 },
    hardness: null,
    priority: null,
  },
  {
    type: 'count',
    targets: { band_ids: ['band-a'] },
    params: { scope: 'per_part', min: 0, max: 1 },
    hardness: null,
    priority: null,
  },
  {
    type: 'count',
    targets: { band_ids: ['band-a'] },
    params: { scope: 'in_parts', part_ids: [1], min: 0, max: 1 },
    hardness: null,
    priority: null,
  },
]

const validateStructuredOutput = new Ajv2020({ strict: false }).compile(
  aiChatOutputJsonSchema,
)

const validateHttpProposal = new Ajv2020({ strict: false }).compile({
  ...openApiDocument.components.schemas.ChatProposedConstraint,
  components: openApiDocument.components,
})

describe('chat DTOs derived from apps/schema', () => {
  it.each(constraints)(
    'accepts $type and its original completed Constraint',
    (constraint) => {
      expect(proposedConstraintSchema.safeParse(constraint).success).toBe(true)
      expect(validateHttpProposal(constraint)).toBe(true)
      expect(
        constraintSchema.safeParse({
          ...constraint,
          schema_version: '1.0.0',
          event_id: 'event-1',
          constraint_id: 'c1',
          hardness: 'hard',
          priority: null,
          enabled: true,
        }).success,
      ).toBe(true)
      expect(
        validateStructuredOutput({
          ...approval(),
          actions: [{ type: 'add_constraint', constraint }],
          placements: [],
        }),
      ).toBe(true)
    },
  )

  it('keeps original schema restrictions in runtime validation', () => {
    expect(
      proposedConstraintSchema.safeParse({
        ...constraints[1],
        targets: { band_ids: ['a'] },
      }).success,
    ).toBe(false)
    expect(
      proposedConstraintSchema.safeParse({
        ...constraints[1],
        targets: { band_ids: ['a', 'a'] },
      }).success,
    ).toBe(false)
    expect(
      proposedConstraintSchema.safeParse({
        ...constraints[0],
        params: { min_diff: 1, same_part_only: false },
      }).success,
    ).toBe(false)
    expect(
      proposedConstraintSchema.safeParse({
        ...constraints[3],
        params: { position: -1 },
      }).success,
    ).toBe(false)
    expect(
      proposedConstraintSchema.safeParse({
        ...constraints[4],
        params: { kind: 'parts', part_ids: ['part-2'] },
      }).success,
    ).toBe(false)
  })

  it('keeps nullable settings unchanged while using the shared validator', () => {
    expect(proposedConstraintSchema.parse(constraints[4])).toEqual(
      constraints[4],
    )
  })

  it.each([
    { ...constraints[4], enabled: true },
    { ...constraints[4], source_text: 'managed by BE' },
    { ...constraints[4], schema_version: '1.0.0' },
    { ...constraints[4], constraint_id: 'managed-id' },
    { ...constraints[4], event_id: 'managed-id' },
    { ...constraints[4], extra: true },
    {
      ...constraints[4],
      params: { kind: 'parts', part_ids: [1, 1] },
    },
    {
      ...constraints[4],
      params: { kind: 'parts', part_ids: [1], position_from: 0 },
    },
  ])(
    'rejects managed fields, unknown fields and invalid union shapes %j',
    (value) => {
      expect(proposedConstraintSchema.safeParse(value).success).toBe(false)
    },
  )

  it('validates approval cardinality more strictly than the provider schema', () => {
    const invalid = { ...approval(), actions: [], placements: [] }
    expect(validateStructuredOutput(invalid)).toBe(true)
    expect(aiChatOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('drops the provider-required empty placements only outside reorder proposals', () => {
    const output = { ...approval(), placements: [] }
    expect(validateStructuredOutput(output)).toBe(true)
    expect(aiChatOutputSchema.parse(output)).toEqual(approval())
    const placements = [{ bandId: 'band-a', partId: 'part-1', order: 0 }]
    const reorder = {
      type: 'reorder_proposal',
      message: '盛り上がる順に並べ替えました。',
      actions: [],
      placements,
    }
    expect(validateStructuredOutput(reorder)).toBe(true)
    expect(aiChatOutputSchema.parse(reorder)).toEqual(reorder)
    for (const invalid of [
      { ...reorder, placements: [] },
      { ...reorder, actions: approval().actions },
      { ...approval(), placements },
      { ...reorder, placements: [{ ...placements[0], order: -1 }] },
    ])
      expect(aiChatOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('emits strict objects with all keys required and no external refs', () => {
    function inspect(value: unknown) {
      if (Array.isArray(value)) return value.forEach(inspect)
      if (typeof value !== 'object' || value === null) return
      const schema = value as Record<string, unknown>
      expect(schema).not.toHaveProperty('$ref')
      expect(schema).not.toHaveProperty('$schema')
      expect(schema).not.toHaveProperty('$id')
      expect(schema).not.toHaveProperty('$defs')
      expect(schema).not.toHaveProperty('oneOf')
      expect(schema).not.toHaveProperty('uniqueItems')
      if (schema.type === 'object') {
        expect(schema.additionalProperties).toBe(false)
        expect(schema.required).toEqual(
          Object.keys(schema.properties as object),
        )
      }
      Object.values(schema).forEach(inspect)
    }
    inspect(aiChatOutputJsonSchema)
  })
})
