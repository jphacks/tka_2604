import { afterEach, describe, expect, it, vi } from 'vitest'

import { registrationRepository as repository } from './registrationRepository'

afterEach(() => vi.unstubAllGlobals())
describe('public registration HTTP adapter', () => {
  it('shares the GET, POST and PATCH contracts without admin requests', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(Response.json({ updatedAt: 'saved' })),
      )
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    await repository.get('event', signal)
    const input = {
      expectedUpdatedAt: 'read',
      bandName: 'A',
      memberIds: ['m1'],
      newMembers: [{ memberName: '田中' }],
    }
    await repository.create('event', input)
    await repository.update('event', 'band', input)
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/events/event/form',
      expect.objectContaining({ method: 'GET', signal }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/events/event/form/bands',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/events/event/form/bands/band',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify(input) }),
    )
  })
  it.each([404, 409, 422, 500])(
    'rejects HTTP %i and preserves the API error code and input reason',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          Response.json(
            {
              error: {
                code: 'event_save_conflict',
                message: '保存できません。',
                details: [{ reason: '名簿を再取得してください。' }],
              },
            },
            { status },
          ),
        ),
      )
      await expect(repository.get('event')).rejects.toMatchObject({
        code: 'event_save_conflict',
        message: '保存できません。 名簿を再取得してください。',
      })
    },
  )
  it('handles network and non-JSON server failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(new Response('unavailable', { status: 503 })),
    )
    await expect(repository.get('event')).rejects.toThrow('offline')
    await expect(repository.get('event')).rejects.toThrow('通信に失敗')
  })
})
