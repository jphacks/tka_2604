import { describe, expect, it, vi } from 'vitest'

import { generateAIChatResponse } from '../../../src/services/chat/generate.ts'
import type { ChatModel } from '../../../src/services/chat/types.ts'
import { approval, currentConstraint, input, proposed } from './fixtures.ts'

describe('AI chat proposal generation', () => {
  it('sends only the latest six historical messages in chronological order', async () => {
    const state = input()
    state.recentMessages = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      text: `message-${index}`,
    }))
    const generate = vi.fn<ChatModel>().mockResolvedValue(approval())
    await generateAIChatResponse(state, generate)
    expect(generate.mock.calls[0][0].recentMessages).toEqual(
      state.recentMessages.slice(-6),
    )
    expect(generate.mock.calls[0][0].userMessage).toBe(state.userMessage)
    expect(state.recentMessages).toHaveLength(10)
  })

  it.each([
    {
      type: 'min_gap_member',
      targets: { member_id: 'member-1' },
      params: { min_diff: 2, same_part_only: false },
    },
    {
      type: 'min_gap_bands',
      targets: { band_ids: ['band-a', 'band-b'] },
      params: { min_diff: 2, same_part_only: false },
    },
    {
      type: 'before',
      targets: { before_band_id: 'band-a', after_band_id: 'band-b' },
      params: {},
    },
    {
      type: 'count',
      targets: { band_ids: ['band-a', 'band-b'] },
      params: { scope: 'in_parts', part_ids: [1], min: 0, max: 2 },
    },
  ])('accepts a valid $type proposal', async (constraint) => {
    const output = {
      ...approval(),
      actions: [
        {
          type: 'add_constraint',
          constraint: { ...constraint, hardness: null, priority: null },
        },
      ],
    }
    expect(
      await generateAIChatResponse(input(), vi.fn().mockResolvedValue(output)),
    ).toEqual(output)
  })

  it('resolves numeric part IDs by sortOrder rather than array index', async () => {
    const state = input()
    state.context.parts[1].sortOrder = 7
    const output = {
      ...approval(),
      actions: [
        {
          type: 'add_constraint',
          constraint: {
            ...proposed(),
            params: { kind: 'parts', part_ids: [7] },
          },
        },
      ],
    }
    expect(
      await generateAIChatResponse(state, vi.fn().mockResolvedValue(output)),
    ).toEqual(output)
  })

  it('allows deletion of an existing disabled constraint with a stale target', async () => {
    const state = input()
    state.context.constraints = [
      { ...currentConstraint(), targets: { band_ids: ['missing'] } },
    ]
    const output = {
      ...approval(),
      actions: [{ type: 'delete_constraint', constraintId: 'constraint-1' }],
    }
    expect(
      await generateAIChatResponse(state, vi.fn().mockResolvedValue(output)),
    ).toEqual(output)
  })

  it('keeps a pending addition and its UI settings separate from saved constraints', async () => {
    const state = input()
    const output = {
      ...approval(),
      actions: [
        {
          type: 'add_constraint',
          constraint: { ...proposed(), hardness: 'soft', priority: 'high' },
        },
      ],
    }
    state.pendingProposal = {
      actions: [
        {
          type: 'add_constraint',
          constraint: { ...proposed(), hardness: 'soft', priority: 'high' },
        },
      ],
    }
    const generate = vi.fn<ChatModel>().mockResolvedValue(output)
    expect(await generateAIChatResponse(state, generate)).toEqual(output)
    expect(generate.mock.calls[0][0].context.constraints).toEqual([])
    expect(generate.mock.calls[0][0].pendingProposal).toEqual(
      state.pendingProposal,
    )
  })

  it('returns an unconfirmed constraint without filling in hardness or priority', async () => {
    const generate = vi.fn().mockResolvedValue(approval())
    const state = input()
    const original = structuredClone(state)
    expect(await generateAIChatResponse(state, generate)).toEqual(approval())
    expect(generate).toHaveBeenCalledWith(state)
    expect(state).toEqual(original)
  })

  it.each(['answer', 'clarification_required'] as const)(
    'returns %s with no actions',
    async (type) => {
      const output = { type, message: '確認してください。', actions: [] }
      expect(
        await generateAIChatResponse(
          input(),
          vi.fn().mockResolvedValue(output),
        ),
      ).toEqual(output)
    },
  )

  it.each([
    { ...approval(), actions: [] },
    { type: 'answer', message: '説明', actions: approval().actions },
    {
      type: 'clarification_required',
      message: '質問',
      actions: approval().actions,
    },
    { ...approval(), message: ' ' },
    { ...approval(), proposalId: 'invented' },
    {
      ...approval(),
      actions: [
        {
          type: 'add_constraint',
          constraint: { ...proposed(), enabled: true },
        },
      ],
    },
    {
      ...approval(),
      actions: [
        {
          type: 'add_constraint',
          constraint: { ...proposed(), targets: { band_ids: ['missing'] } },
        },
      ],
    },
    {
      ...approval(),
      actions: [
        {
          type: 'add_constraint',
          constraint: {
            ...proposed(),
            params: { kind: 'parts', part_ids: [2] },
          },
        },
      ],
    },
    {
      ...approval(),
      actions: [
        {
          type: 'add_constraint',
          constraint: { ...proposed(), hardness: 'hard', priority: 'high' },
        },
      ],
    },
    {
      ...approval(),
      actions: [{ type: 'delete_constraint', constraintId: 'missing' }],
    },
  ])(
    'rejects malformed or semantically invalid model output %#',
    async (output) => {
      await expect(
        generateAIChatResponse(input(), vi.fn().mockResolvedValue(output)),
      ).rejects.toMatchObject({ code: 'ai_chat_invalid_output' })
    },
  )

  it('validates positions against all bands, including unassigned bands', async () => {
    const output = approval()
    output.actions[0].constraint = {
      type: 'at_position',
      targets: { band_id: 'band-b' },
      params: { position: 1 },
      hardness: null,
      priority: null,
    }
    expect(
      await generateAIChatResponse(input(), vi.fn().mockResolvedValue(output)),
    ).toEqual(output)
    output.actions[0].constraint.params = { position: 2 }
    await expect(
      generateAIChatResponse(input(), vi.fn().mockResolvedValue(output)),
    ).rejects.toMatchObject({ code: 'ai_chat_invalid_output' })
  })

  it.each([
    {
      type: 'before',
      targets: { before_band_id: 'band-a', after_band_id: 'band-a' },
      params: {},
    },
    {
      type: 'min_gap_member',
      targets: { member_id: 'missing' },
      params: { min_diff: 2, same_part_only: false },
    },
    {
      type: 'min_gap_bands',
      targets: { band_ids: ['band-a', 'band-a'] },
      params: { min_diff: 2, same_part_only: false },
    },
    {
      type: 'in_range',
      targets: { band_ids: ['band-a'] },
      params: { kind: 'positions', position_from: 1, position_to: 0 },
    },
    {
      type: 'count',
      targets: { band_ids: ['band-a'] },
      params: { scope: 'per_part', min: 2, max: 1 },
    },
  ])(
    'rejects invalid targets and numeric boundaries %#',
    async (constraint) => {
      const output = {
        ...approval(),
        actions: [
          {
            type: 'add_constraint',
            constraint: { ...constraint, hardness: null, priority: null },
          },
        ],
      }
      await expect(
        generateAIChatResponse(input(), vi.fn().mockResolvedValue(output)),
      ).rejects.toMatchObject({ code: 'ai_chat_invalid_output' })
    },
  )

  it('inherits settings for updates and keeps disabled constraints in context', async () => {
    const state = input()
    state.context.constraints = [currentConstraint()]
    const generate = vi.fn<ChatModel>().mockResolvedValue({
      ...approval(),
      actions: [
        {
          type: 'update_constraint',
          constraintId: 'constraint-1',
          constraint: proposed(),
        },
      ],
    })
    const result = await generateAIChatResponse(state, generate)
    expect(result.actions[0]).toMatchObject({
      constraintId: 'constraint-1',
      constraint: { hardness: 'soft', priority: 'high' },
    })
    expect(generate.mock.calls[0][0].context.constraints[0].enabled).toBe(false)
  })

  it('inherits pending UI settings ahead of the current saved settings', async () => {
    const state = input()
    state.context.constraints = [currentConstraint()]
    state.pendingProposal = {
      actions: [
        {
          type: 'update_constraint',
          constraintId: 'constraint-1',
          constraint: { ...proposed(), hardness: 'hard', priority: null },
        },
      ],
    }
    const result = await generateAIChatResponse(
      state,
      vi.fn().mockResolvedValue({
        ...approval(),
        actions: [
          {
            type: 'update_constraint',
            constraintId: 'constraint-1',
            constraint: proposed(),
          },
        ],
      }),
    )
    expect(result.actions[0]).toMatchObject({
      constraint: { hardness: 'hard', priority: null },
    })
  })

  it('does not invent a soft priority when changing a hard constraint to soft', async () => {
    const state = input()
    state.context.constraints = [
      { ...currentConstraint(), hardness: 'hard', priority: null },
    ]
    const result = await generateAIChatResponse(
      state,
      vi.fn().mockResolvedValue({
        ...approval(),
        actions: [
          {
            type: 'update_constraint',
            constraintId: 'constraint-1',
            constraint: { ...proposed(), hardness: 'soft' },
          },
        ],
      }),
    )
    expect(result.actions[0]).toMatchObject({
      constraint: { hardness: 'soft', priority: null },
    })
  })

  it('rejects two operations against the same existing constraint', async () => {
    const state = input()
    state.context.constraints = [currentConstraint()]
    await expect(
      generateAIChatResponse(
        state,
        vi.fn().mockResolvedValue({
          ...approval(),
          actions: [
            { type: 'delete_constraint', constraintId: 'constraint-1' },
            {
              type: 'update_constraint',
              constraintId: 'constraint-1',
              constraint: proposed(),
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: 'ai_chat_invalid_output' })
  })

  it('rejects invalid input and pending proposals before calling the model', async () => {
    const generate = vi.fn()
    await expect(
      generateAIChatResponse({ ...input(), userMessage: '' }, generate),
    ).rejects.toMatchObject({ code: 'ai_chat_invalid_input' })
    await expect(
      generateAIChatResponse(
        {
          ...input(),
          pendingProposal: {
            actions: [{ type: 'delete_constraint', constraintId: 'missing' }],
          },
        },
        generate,
      ),
    ).rejects.toMatchObject({ code: 'ai_chat_invalid_input' })
    const state = input()
    state.context.memberships[0].bandId = 'missing'
    await expect(generateAIChatResponse(state, generate)).rejects.toMatchObject(
      { code: 'ai_chat_invalid_input' },
    )
    expect(generate).not.toHaveBeenCalled()
  })
})
