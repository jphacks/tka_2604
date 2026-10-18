import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

it.each(['development', 'production', 'test'])(
  'loads an empty database through the API in %s, regardless of old flags',
  async (mode) => {
    vi.stubEnv('MODE', mode)
    vi.stubEnv('VITE_DATA_SOURCE', 'mock')
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ events: [] }))
    vi.stubGlobal('fetch', fetcher)
    const { workspaceRepository } = await import('./workspaceRepository')
    await expect(workspaceRepository.listEvents()).resolves.toEqual([])
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0][0]).toContain('/api/events')
  },
)

it('reports API errors without returning sample events', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
  )
  const { workspaceRepository } = await import('./workspaceRepository')
  await expect(workspaceRepository.listEvents()).rejects.toThrow('offline')
  await expect(
    workspaceRepository.createEvent({
      name: '保存対象',
      date: '',
      venue: '',
      description: '',
    }),
  ).rejects.toThrow('offline')
})
