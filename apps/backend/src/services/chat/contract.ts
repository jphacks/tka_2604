import { z } from 'zod'

import common from '../../../../schema/common.schema.json' with { type: 'json' }
import { validateConstraint } from '../../shared/constraints/schema.ts'
import {
  constraintJsonSchema,
  constraintSchema,
  type JsonSchema,
} from '../constraints/schema.ts'
import type { AIChatInput, AIChatOutput, ProposedConstraint } from './types.ts'

const managedFields = new Set([
  'schema_version',
  'constraint_id',
  'event_id',
  'source_text',
  'hardness',
  'priority',
  'enabled',
])

// Only remove BE-managed fields; targets, params and their limits come from apps/schema.
export const proposedConstraintJsonSchema: JsonSchema = {
  anyOf: constraintJsonSchema.oneOf!.map((variant) => ({
    ...variant,
    properties: {
      ...Object.fromEntries(
        Object.entries(variant.properties!).filter(
          ([key]) => !managedFields.has(key),
        ),
      ),
      hardness: { type: ['string', 'null'], enum: ['hard', 'soft', null] },
      priority: {
        type: ['string', 'null'],
        enum: ['high', 'mid', 'low', null],
      },
    },
    required: [
      ...variant.required!.filter((key) => !managedFields.has(key)),
      'hardness',
      'priority',
    ],
  })),
}

const proposalSettingsSchema = z.object({
  hardness: z.enum(['hard', 'soft']).nullable(),
  priority: z.enum(['high', 'mid', 'low']).nullable(),
})

export const proposedConstraintSchema = z.custom<ProposedConstraint>(
  (value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return false
    if (!proposalSettingsSchema.safeParse(value).success) return false
    if (
      [...managedFields].some(
        (key) => key !== 'hardness' && key !== 'priority' && key in value,
      )
    )
      return false
    // Temporary envelope for shape validation only. The actual proposal keeps its
    // nullable settings and never receives these BE-managed fields or defaults.
    return validateConstraint({
      ...value,
      schema_version: common.$defs.SchemaVersion.enum[0],
      constraint_id: 'proposal-validation',
      event_id: 'proposal-validation',
      enabled: true,
      hardness: 'hard',
      priority: null,
    })
  },
)

const id = z.string().min(1)
const order = z.number().int().nonnegative()
const placementSchema = z.strictObject({ bandId: id, partId: id, order })
const actionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('add_constraint'),
    constraint: proposedConstraintSchema,
  }),
  z.strictObject({
    type: z.literal('update_constraint'),
    constraintId: id,
    constraint: proposedConstraintSchema,
  }),
  z.strictObject({ type: z.literal('delete_constraint'), constraintId: id }),
])

export const aiChatInputSchema: z.ZodType<AIChatInput> = z.strictObject({
  context: z.strictObject({
    event: z.strictObject({ title: z.string() }),
    parts: z.array(
      z.strictObject({
        partId: id,
        sortOrder: order,
        partName: z.string().nullable(),
      }),
    ),
    bands: z.array(
      z.strictObject({
        bandId: id,
        bandName: z.string(),
        description: z.string().nullable(),
      }),
    ),
    members: z.array(z.strictObject({ memberId: id, memberName: z.string() })),
    memberships: z.array(z.strictObject({ bandId: id, memberId: id })),
    constraints: z.array(constraintSchema),
    currentPlacements: z.array(placementSchema),
  }),
  recentMessages: z.array(
    z.strictObject({ role: z.enum(['user', 'assistant']), text: z.string() }),
  ),
  userMessage: z.string().max(1000).trim().min(1),
  pendingProposal: z
    .strictObject({ actions: z.array(actionSchema).min(1) })
    .nullable(),
})

// Structured Outputs require every property, so non-reorder replies carry an
// empty placements array that is dropped before the strict per-type check.
function dropEmptyPlacements(value: unknown) {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('placements' in value) ||
    !Array.isArray(value.placements) ||
    value.placements.length > 0 ||
    ('type' in value && value.type === 'reorder_proposal')
  )
    return value
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'placements'),
  )
}

export const aiChatOutputSchema: z.ZodType<AIChatOutput> = z.preprocess(
  dropEmptyPlacements,
  z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('approval_required'),
      message: z.string().trim().min(1),
      actions: z.tuple([actionSchema]).rest(actionSchema),
    }),
    z.strictObject({
      type: z.literal('clarification_required'),
      message: z.string().trim().min(1),
      actions: z.tuple([]),
    }),
    z.strictObject({
      type: z.literal('answer'),
      message: z.string().trim().min(1),
      actions: z.tuple([]),
    }),
    z.strictObject({
      type: z.literal('reorder_proposal'),
      message: z.string().trim().min(1),
      actions: z.tuple([]),
      placements: z.tuple([placementSchema]).rest(placementSchema),
    }),
  ]),
)

// Keep the provider-facing schema simple. Response-specific cardinality and
// uniqueness are checked again with the original schemas after generation.
function forStructuredOutputs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(forStructuredOutputs)
  if (typeof value !== 'object' || value === null) return value
  const object = Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          ![
            '$schema',
            '$id',
            '$defs',
            'title',
            'uniqueItems',
            'minItems',
            'maxItems',
          ].includes(key),
      )
      .map(([key, item]) => [
        key === 'oneOf' ? 'anyOf' : key,
        forStructuredOutputs(item),
      ]),
  )
  if (object.type === 'object') {
    object.additionalProperties = false
    object.required = Object.keys(object.properties as Record<string, unknown>)
  }
  return object
}

const actionJsonSchema: JsonSchema = {
  anyOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['add_constraint'] },
        constraint: proposedConstraintJsonSchema,
      },
      required: ['type', 'constraint'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['update_constraint'] },
        constraintId: { type: 'string' },
        constraint: proposedConstraintJsonSchema,
      },
      required: ['type', 'constraintId', 'constraint'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['delete_constraint'] },
        constraintId: { type: 'string' },
      },
      required: ['type', 'constraintId'],
    },
  ],
}

export const aiChatOutputJsonSchema = forStructuredOutputs({
  type: 'object',
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      enum: [
        'approval_required',
        'clarification_required',
        'answer',
        'reorder_proposal',
      ],
    },
    message: { type: 'string' },
    actions: { type: 'array', items: actionJsonSchema },
    placements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          bandId: { type: 'string' },
          partId: { type: 'string' },
          order: { type: 'integer', minimum: 0 },
        },
      },
    },
  },
  required: ['type', 'message', 'actions', 'placements'],
}) as JsonSchema
