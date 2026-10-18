import { describe, expect, it, vi } from 'vitest'

import { chatService } from '../../../src/services/chat/service.ts'
import type { ChatModel } from '../../../src/services/chat/types.ts'
import { EventError } from '../../../src/services/events/errors'
import type { EventRepository } from '../../../src/services/events/types'
import { approval, snapshot } from './fixtures.ts'

function fixture() {
  const state = snapshot()
  const repository = {
    get: vi.fn<EventRepository['get']>().mockResolvedValue(state.event),
    getSchedule: vi
      .fn<EventRepository['getSchedule']>()
      .mockResolvedValue(state.schedule),
    getConstraints: vi
      .fn<EventRepository['getConstraints']>()
      .mockResolvedValue({
        eventId: state.constraints.eventId,
        updatedAt: state.constraints.updatedAt,
        constraints: state.constraints.constraints.map(
          ({ constraint, sourceBandId }) => ({
            constraintId: constraint.constraint_id,
            constraintJson: JSON.stringify(constraint),
            sourceBandId,
          }),
        ),
      }),
    getChat: vi.fn<EventRepository['getChat']>().mockResolvedValue(state.chat),
    list: vi.fn<EventRepository['list']>(),
    create: vi.fn<EventRepository['create']>(),
    update: vi.fn<EventRepository['update']>(),
    remove: vi.fn<EventRepository['remove']>(),
  }
  const model = vi.fn<ChatModel>().mockResolvedValue(approval())
  return {
    repository,
    model,
    state,
    service: chatService(repository, 'owner', model),
  }
}

const turn = { userMessage: 'Aを第2部にしたい', pendingProposal: null }

describe('chat service aligned with event APIs', () => {
  it('reads all state through the owner-scoped repository and returns its generation version', async () => {
    const { repository, model, state, service } = fixture()
    const result = await service.generate('event-1', turn)
    expect(result).toEqual({
      eventId: 'event-1',
      updatedAt: state.event.updatedAt,
      output: approval(),
    })
    for (const method of [
      'get',
      'getSchedule',
      'getConstraints',
      'getChat',
    ] as const)
      expect(repository[method]).toHaveBeenCalledWith('owner', 'event-1')
    expect(model.mock.calls[0][0].context.constraints).toEqual(
      state.constraints.constraints.map((row) => row.constraint),
    )
    expect(repository.create).not.toHaveBeenCalled()
    expect(repository.update).not.toHaveBeenCalled()
    expect(repository.remove).not.toHaveBeenCalled()
  })

  it('passes band descriptions to the model and returns the BE judgement of a reorder', async () => {
    const { model, state, service } = fixture()
    state.schedule.bands[0].description = '明るいポップス'
    const placements = [{ bandId: 'band-a', partId: 'part-2', order: 0 }]
    const output = {
      type: 'reorder_proposal' as const,
      message: 'Aを後ろにしました。',
      actions: [],
      placements,
    }
    model.mockResolvedValueOnce(output)
    const result = await service.generate('event-1', turn)
    expect(model.mock.calls[0][0].context.bands[0]).toEqual({
      bandId: 'band-a',
      bandName: 'A',
      description: '明るいポップス',
    })
    expect(result).toEqual({
      eventId: 'event-1',
      updatedAt: state.event.updatedAt,
      output,
      reorder: {
        placements,
        source: 'llm',
        results: [
          {
            constraintId: 'constraint-1',
            hardness: 'soft',
            priority: 'high',
            before: 'disabled',
            after: 'disabled',
            violations: [],
            explanations: [],
          },
        ],
      },
    })
  })

  it.each(['get', 'getSchedule', 'getConstraints', 'getChat'] as const)(
    'does not call the model when %s cannot see the event',
    async (method) => {
      const { repository, model, service } = fixture()
      repository[method].mockResolvedValueOnce(null)
      await expect(service.generate('missing', turn)).rejects.toBeInstanceOf(
        EventError,
      )
      expect(model).not.toHaveBeenCalled()
    },
  )

  it('does not call the model when separately read event versions differ', async () => {
    const { repository, model, state, service } = fixture()
    repository.getSchedule.mockResolvedValueOnce({
      ...state.schedule,
      updatedAt: '2026-10-17T00:00:01.000Z',
    })
    await expect(service.generate('event-1', turn)).rejects.toMatchObject({
      code: 'event_save_conflict',
    })
    expect(model).not.toHaveBeenCalled()
  })

  it('treats corrupt stored constraints as an internal data failure before calling the model', async () => {
    const { repository, model, state, service } = fixture()
    repository.getConstraints.mockResolvedValueOnce({
      eventId: 'event-1',
      updatedAt: state.event.updatedAt,
      constraints: [
        { constraintId: 'c1', constraintJson: '{', sourceBandId: null },
      ],
    })
    await expect(service.generate('event-1', turn)).rejects.toThrow()
    expect(model).not.toHaveBeenCalled()
  })

  it('propagates repository failures before model invocation', async () => {
    const { repository, model, service } = fixture()
    repository.get.mockRejectedValueOnce(new Error('DB unavailable'))
    await expect(service.generate('event-1', turn)).rejects.toThrow(
      'DB unavailable',
    )
    expect(model).not.toHaveBeenCalled()
  })
})
