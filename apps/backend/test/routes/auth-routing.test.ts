import { expect, it, vi } from 'vitest'

import app from '../../src/index'

// GHSA-h7mg-cq63-vhpq: encoded line terminators must not skip /api/* auth.
it.each(['%0A', '%0D', '%E2%80%A8', '%E2%80%A9'])(
  'authenticates unknown API paths containing %s before falling through',
  async (encoded) => {
    const external = vi.spyOn(globalThis, 'fetch')
    for (const method of [
      'GET',
      'HEAD',
      'POST',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ]) {
      // Omit bindings to prove that rejection happens before business access.
      const response = await app.request(`/api/security-probe/${encoded}`, {
        method,
      })
      expect(response.status, method).toBe(401)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      if (method !== 'HEAD')
        expect(await response.json()).toMatchObject({
          error: { code: 'unauthorized' },
        })
    }
    expect(external).not.toHaveBeenCalled()
  },
)
