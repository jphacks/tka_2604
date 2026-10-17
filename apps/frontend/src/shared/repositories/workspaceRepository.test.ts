import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../mock/workspaceRepository', () => ({
  mockWorkspaceRepository: {
    getSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    listEvents: vi.fn(),
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
  it('uses the existing mock repository by default', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', '')
    const { workspaceRepository } = await import('./workspaceRepository')
    const { mockWorkspaceRepository } =
      await import('../../mock/workspaceRepository')
    expect(workspaceRepository).toBe(mockWorkspaceRepository)
  })
  it('never falls back to mock data after an API error or unsupported operation', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'api')
    const { workspaceRepository } = await import('./workspaceRepository')
    const { mockWorkspaceRepository } =
      await import('../../mock/workspaceRepository')
    const list = vi.spyOn(mockWorkspaceRepository, 'listEvents')
    const registration = vi.spyOn(mockWorkspaceRepository, 'getRegistration')
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
      workspaceRepository.getRegistration('event-1'),
    ).rejects.toThrow('準備中')
    await expect(
      workspaceRepository.deletePerformance('event-1', 'b1'),
    ).rejects.toThrow('準備中')
    expect(list).not.toHaveBeenCalled()
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
