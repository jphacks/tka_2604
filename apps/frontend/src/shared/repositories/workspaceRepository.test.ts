import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../mock/workspaceRepository', () => ({
  mockWorkspaceRepository: {
    getSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    listEvents: vi.fn(),
    createEvent: vi.fn(),
    getRegistration: vi.fn(),
    rememberEvent: vi.fn(),
  },
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('repository data source', () => {
  it.each([undefined, ''])(
    'uses API data by default when the mode is %s',
    async (mode) => {
      vi.stubEnv('VITE_DATA_SOURCE', mode)
      const { workspaceRepository } = await import('./workspaceRepository')
      const { mockWorkspaceRepository } =
        await import('../../mock/workspaceRepository')
      expect(workspaceRepository).not.toBe(mockWorkspaceRepository)
      await expect(
        workspaceRepository.getRegistration('event-1'),
      ).rejects.toThrow('準備中')
    },
  )
  it('uses the existing mock repository only when requested', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'mock')
    const { workspaceRepository } = await import('./workspaceRepository')
    const { mockWorkspaceRepository } =
      await import('../../mock/workspaceRepository')
    expect(workspaceRepository).toBe(mockWorkspaceRepository)
  })
  it.each(['development', 'production'])(
    'uses the real API in %s even if an old mock flag remains',
    async (mode) => {
      vi.stubEnv('MODE', mode)
      vi.stubEnv('VITE_DATA_SOURCE', 'mock')
      const { workspaceRepository } = await import('./workspaceRepository')
      const { mockWorkspaceRepository } =
        await import('../../mock/workspaceRepository')
      expect(workspaceRepository).not.toBe(mockWorkspaceRepository)
    },
  )
  it('never falls back to mock data after an API error or unsupported operation', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'api')
    const { workspaceRepository } = await import('./workspaceRepository')
    const { mockWorkspaceRepository } =
      await import('../../mock/workspaceRepository')
    const list = vi.spyOn(mockWorkspaceRepository, 'listEvents')
    const registration = vi.spyOn(mockWorkspaceRepository, 'getRegistration')
    const create = vi.spyOn(mockWorkspaceRepository, 'createEvent')
    const remember = vi.spyOn(mockWorkspaceRepository, 'rememberEvent')
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
    )
    // The client is created when the module loads, so reload it with this transport.
    vi.resetModules()
    const { workspaceRepository: withFailure } =
      await import('./workspaceRepository')
    await expect(withFailure.listEvents()).rejects.toThrow('offline')
    await expect(
      withFailure.createEvent({
        name: 'DBに保存するイベント',
        date: '',
        venue: '',
        description: '',
      }),
    ).rejects.toThrow('offline')
    await expect(
      workspaceRepository.getRegistration('event-1'),
    ).rejects.toThrow('準備中')
    await expect(
      workspaceRepository.deletePerformance('event-1', 'b1'),
    ).rejects.toThrow('準備中')
    expect(list).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(registration).not.toHaveBeenCalled()
    workspaceRepository.rememberEvent({
      id: 'event-1',
      name: 'A',
      members: [],
      performances: [],
      sections: [],
      constraints: [],
      unassigned: [],
      messages: [],
    })
    expect(remember).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
