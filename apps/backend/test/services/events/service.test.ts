import { describe, expect, it, vi } from 'vitest'

import { eventService } from '../../../src/services/events/service'
import type { EventRepository } from '../../../src/services/events/types'

function fixture() {
  const repository = {
    list: vi.fn<EventRepository['list']>().mockResolvedValue([]),
    get: vi.fn<EventRepository['get']>().mockResolvedValue(null),
    create: vi.fn<EventRepository['create']>(),
    update: vi.fn<EventRepository['update']>(),
    remove: vi.fn<EventRepository['remove']>().mockResolvedValue(undefined),
  }
  return { repository, service: eventService(repository, 'owner') }
}

describe('event service', () => {
  it('passes a trusted owner to every operation and reports missing basic details', async () => {
    const { repository, service } = fixture()
    expect(await service.list()).toEqual([])
    expect(repository.list).toHaveBeenCalledWith('owner')
    await expect(service.get('missing')).rejects.toThrow('event_not_found')
    expect(repository.get).toHaveBeenCalledWith('owner', 'missing')
    await service.create({ title: 'Live' })
    expect(repository.create).toHaveBeenCalledWith('owner', { title: 'Live' })
    await service.update('event', {
      expectedUpdatedAt: '2026-10-17T00:00:00.000Z',
      title: 'Changed',
    })
    expect(repository.update).toHaveBeenCalledWith(
      'owner',
      'event',
      '2026-10-17T00:00:00.000Z',
      { title: 'Changed' },
    )
    await service.remove('event')
    expect(repository.remove).toHaveBeenCalledWith('owner', 'event')
  })

  it('propagates DB failures without returning a successful mutation', async () => {
    const { repository, service } = fixture()
    repository.remove.mockRejectedValue(new Error('DB failed'))
    await expect(service.remove('event')).rejects.toThrow('DB failed')
  })
})
