import { hc } from 'hono/client'
import { describe, expect, expectTypeOf, it } from 'vitest'

import app, { type AppType } from '../src/index'
import { openApiDocument } from '../src/openapi'

describe('API routing', () => {
  it('returns the API health status', async () => {
    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('serves the separately maintained OpenAPI document', async () => {
    const response = await app.request('/api/openapi.json')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(openApiDocument.openapi).toBe('3.1.0')
    expect(await response.json()).toEqual(openApiDocument)
  })

  it('serves Swagger UI pointing at the OpenAPI specification', async () => {
    const response = await app.request('/api/docs')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html).toContain('SwaggerUIBundle')
    expect(html).toContain('/api/openapi.json')
  })

  it('uses the shared backend origin for the specification and API requests', async () => {
    const origin = 'https://shared.example.com'
    const ui = await app.request(`${origin}/api/docs`)
    const html = await ui.text()
    expect(html).toContain("url: '/api/openapi.json'")
    expect(html).not.toContain('localhost')

    const specification = await app.request(`${origin}/api/openapi.json`)
    expect(await specification.json()).toMatchObject({
      servers: [{ url: '/' }],
    })
    const response = await app.request(
      new URL('/api/health', origin).toString(),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ok',
    })
  })

  it('infers and fetches the health response through the RPC client', async () => {
    const client = hc<AppType>('http://localhost', {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
        app.request(input instanceof URL ? input.toString() : input, init),
    })
    const response = await client.api.health.$get()
    const body = await response.json()

    expectTypeOf(body).toEqualTypeOf<{ status: string }>()
    expect(response.status).toBe(200)
    expect(body).toEqual({ status: 'ok' })
  })

  it('returns JSON with 404 for unknown API routes', async () => {
    const response = await app.request('/api/unknown')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not Found' })
  })
})
