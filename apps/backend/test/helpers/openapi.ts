import { Ajv2020, type AnySchema } from 'ajv/dist/2020.js'
import { expect } from 'vitest'

type JsonResponses = Record<
  string,
  { description?: string; content?: Record<string, { schema?: AnySchema }> }
>

const ajv = new Ajv2020({ allErrors: true })

// The caller selects the operation from the handwritten OpenAPI document.
export async function expectJsonResponse(
  response: Response,
  responses: JsonResponses,
) {
  const definition = responses[String(response.status)]
  if (!definition) {
    throw new Error(`Undocumented response status: ${response.status}`)
  }
  const contentType = response.headers.get('content-type')?.split(';')[0].trim()
  if (
    contentType !== 'application/json' ||
    !definition.content?.[contentType]
  ) {
    throw new Error(`Undocumented response Content-Type: ${contentType}`)
  }
  const schema = definition.content[contentType].schema
  if (schema === undefined) throw new Error('Missing JSON response schema')

  const validate = ajv.compile(schema)
  const body: unknown = await response.clone().json()
  expect(validate(body), ajv.errorsText(validate.errors)).toBe(true)
}
