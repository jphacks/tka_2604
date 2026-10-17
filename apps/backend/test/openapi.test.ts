import { describe, expect, it } from 'vitest'

import app from '../src/index'
import { openApiDocument } from '../src/openapi'
import { expectJsonResponse } from './helpers/openapi'

const responses = openApiDocument.paths['/api/health'].get.responses

describe('OpenAPI response contract', () => {
  it('validates the real health response against the handwritten specification', async () => {
    await expectJsonResponse(await app.request('/api/health'), responses)
  })

  it.each([
    ['missing required property', {}, 'required'],
    ['wrong property type', { status: 1 }, 'string'],
    ['undocumented enum value', { status: 'down' }, 'allowed values'],
  ])('rejects %s', async (_name, body, message) => {
    await expect(
      expectJsonResponse(Response.json(body), responses),
    ).rejects.toThrow(message)
  })

  it('rejects a status not documented for the operation', async () => {
    await expect(
      expectJsonResponse(
        Response.json({ status: 'ok' }, { status: 201 }),
        responses,
      ),
    ).rejects.toThrow('Undocumented response status: 201')
  })

  it('rejects an undocumented Content-Type even when the body is valid JSON', async () => {
    await expect(
      expectJsonResponse(new Response('{"status":"ok"}'), responses),
    ).rejects.toThrow('Undocumented response Content-Type')
  })

  it('detects a specification change that no longer matches the real response', async () => {
    const changedResponses = structuredClone(responses)
    changedResponses['200'].content[
      'application/json'
    ].schema.properties.status.enum = ['ready']

    await expect(
      expectJsonResponse(await app.request('/api/health'), changedResponses),
    ).rejects.toThrow('allowed values')
  })
})
