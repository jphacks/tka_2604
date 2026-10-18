import { type Context, Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'
import type { z } from 'zod'

import { FormError } from '../services/form/errors'
import type { formService } from '../services/form/service'
import {
  createFormBandSchema,
  updateFormBandSchema,
} from '../services/form/validation'

type InputContext<
  Bindings extends object,
  Path extends string,
  Schema extends z.ZodType,
> = Context<
  { Bindings: Bindings },
  Path,
  { in: { json: z.input<Schema> }; out: { json: z.output<Schema> } }
>

function jsonInput<T extends z.ZodType>(schema: T) {
  return validator('json', (body: unknown) => {
    const parsed = schema.safeParse(body)
    if (!parsed.success)
      throw new FormError(
        'invalid_input',
        parsed.error.issues.map((issue) => ({
          path: `/${issue.path.join('/')}`,
          reason: issue.message,
        })),
      )
    return parsed.data
  })
}

// Public roster operations: no administrator owner placeholder or auth middleware.
export function createFormRoutes<Bindings extends object>(
  service: (bindings: Bindings) => ReturnType<typeof formService>,
) {
  return new Hono<{ Bindings: Bindings }>()
    .onError((error, c) => {
      if (error instanceof FormError) {
        const status =
          error.code === 'invalid_input'
            ? 422
            : error.code === 'event_save_conflict'
              ? 409
              : 404
        const messages = {
          invalid_input: '入力データが不正です。',
          event_not_found: 'イベントが見つかりません。',
          band_not_found: 'バンドが見つかりません。',
          event_save_conflict: 'イベントが更新されました。再取得してください。',
        }
        return c.json(
          {
            error: {
              code: error.code,
              message: messages[error.code],
              details: error.details,
            },
          },
          status,
        )
      }
      if (error instanceof HTTPException && error.status === 400)
        return c.json(
          {
            error: {
              code: 'invalid_input',
              message: 'JSONの形式が不正です。',
              details: [],
            },
          },
          400,
        )
      return c.json(
        {
          error: {
            code: 'internal_error',
            message: 'フォームの処理に失敗しました。',
            details: [],
          },
        },
        500,
      )
    })
    .get('/:eventId/form', async (c) =>
      c.json(await service(c.env).get(c.req.param('eventId')), 200),
    )
    .post(
      '/:eventId/form/bands',
      jsonInput(createFormBandSchema),
      async (
        c: InputContext<
          Bindings,
          '/:eventId/form/bands',
          typeof createFormBandSchema
        >,
      ) =>
        c.json(
          await service(c.env).create(
            c.req.param('eventId'),
            c.req.valid('json'),
          ),
          201,
        ),
    )
    .patch(
      '/:eventId/form/bands/:bandId',
      jsonInput(updateFormBandSchema),
      async (
        c: InputContext<
          Bindings,
          '/:eventId/form/bands/:bandId',
          typeof updateFormBandSchema
        >,
      ) =>
        c.json(
          await service(c.env).update(
            c.req.param('eventId'),
            c.req.param('bandId'),
            c.req.valid('json'),
          ),
          200,
        ),
    )
}

// FE can import the route shape without D1 or generated Worker binding types.
export type FormAppType = ReturnType<typeof createFormRoutes>
