import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

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

it('resolves component references and rejects an invalid nested Constraint', async () => {
  const responses =
    openApiDocument.paths['/api/events/{eventId}/constraints'].get.responses
  const example = responses['200'].content['application/json'].example
  await expectJsonResponse(Response.json(example), responses)
  const changed = structuredClone(example)
  changed.constraints[0].constraint.type = 'unknown'
  await expect(
    expectJsonResponse(Response.json(changed), responses),
  ).rejects.toThrow()
})

it('keeps every OpenAPI Constraint schema equal to its canonical source after reference relocation', async () => {
  const names = {
    constraint: 'Constraint',
    common: 'ConstraintCommon',
    min_gap_member: 'ConstraintMinGapMember',
    min_gap_bands: 'ConstraintMinGapBands',
    before: 'ConstraintBefore',
    at_position: 'ConstraintAtPosition',
    in_range: 'ConstraintInRange',
    count: 'ConstraintCount',
  } as const
  for (const [file, name] of Object.entries(names)) {
    const source: unknown = JSON.parse(
      await readFile(
        new URL(`../../schema/${file}.schema.json`, import.meta.url),
        'utf8',
      ),
    )
    function normalize(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(normalize)
      if (value !== null && typeof value === 'object')
        return Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== '$id' && key !== '$schema')
            .map(([key, item]: [string, unknown]) => {
              if (
                key === '$ref' &&
                typeof item === 'string' &&
                item.startsWith('#/components/schemas/')
              ) {
                const rest = item.slice('#/components/schemas/'.length)
                const [target, ...pointer] = rest.split('/')
                const targetFile = Object.entries(names).find(
                  ([, component]) => component === target,
                )?.[0]
                return [
                  key,
                  (targetFile === file ? '' : `${targetFile}.schema.json`) +
                    (pointer.length ? '#/' + pointer.join('/') : ''),
                ]
              }
              return [key, normalize(item)]
            }),
        )
      return value
    }
    expect(normalize(openApiDocument.components.schemas[name])).toEqual(
      normalize(source),
    )
  }
})
