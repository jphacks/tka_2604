import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'
import type { z } from 'zod'

export function credentials<T extends z.ZodType>(
  schema: T,
  message = 'ログインIDとパスワードの入力を確認してください。',
) {
  return validator('json', async (value: unknown, c) => {
    // Judge the media type separately from its optional parameters. Older Hono
    // validators skip JSON with whitespace, trailing ';', or parameter names
    // such as unusual_parameter, passing {} to this callback instead.
    const mediaType = c.req.header('Content-Type')?.split(';', 1)[0].trim()
    if (mediaType?.toLowerCase() === 'application/json') {
      try {
        value = await c.req.json()
      } catch {
        throw new HTTPException(400, {
          message: 'Malformed JSON in request body',
        })
      }
    }
    const result = schema.safeParse(value)
    if (!result.success)
      return c.json(
        { error: { code: 'invalid_input', message, details: [] } },
        422,
      )
    return result.data
  })
}
