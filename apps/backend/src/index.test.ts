import { describe, expect, it } from 'vitest'

import app from './index'

describe('API routing', () => {
  it('returns the API health status', async () => {
    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('returns JSON with 404 for unknown API routes', async () => {
    const response = await app.request('/api/unknown')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not Found' })
  })
})
