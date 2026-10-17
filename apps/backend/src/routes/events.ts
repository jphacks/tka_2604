import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'

import { createDb } from '../db/index'
import { eventsRepository } from '../repositories/events'
import { EventError } from '../services/events/errors'
import { eventService } from '../services/events/service'
import {
  createEventSchema,
  updateEventSchema,
} from '../services/events/validation'

type EventEnv = {
  Bindings: CloudflareBindings
  Variables: { eventService: ReturnType<typeof eventService> }
}

export const eventRoutes = new Hono<EventEnv>()
  .onError((error, c) => {
    if (error instanceof EventError) {
      const status = error.code === 'event_not_found' ? 404 : 409
      return c.json(
        {
          error: {
            code: error.code,
            message:
              status === 404
                ? 'イベントが見つかりません。'
                : 'イベントが更新されました。再取得してください。',
            details: [],
          },
        },
        status,
      )
    }
    if (error instanceof HTTPException && error.status === 400) {
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
    }
    return c.json(
      {
        error: {
          code: 'internal_error',
          message: 'イベントの処理に失敗しました。',
          details: [],
        },
      },
      500,
    )
  })
  .use('*', async (c, next) => {
    // #57 replaces this server-side placeholder with the authenticated user ID.
    // Never resolve the owner from query parameters, request bodies or headers.
    const userId = 'demo-owner'
    c.set(
      'eventService',
      eventService(eventsRepository(createDb(c.env.DB)), userId),
    )
    await next()
  })
  .get('/', async (c) =>
    c.json({ events: await c.var.eventService.list() }, 200),
  )
  .post(
    '/',
    validator('json', (body: unknown, c) => {
      const parsed = createEventSchema.safeParse(body)
      if (!parsed.success)
        return c.json(
          {
            error: {
              code: 'invalid_input',
              message: '入力データが不正です。',
              details: parsed.error.issues.map((issue) => ({
                path: `/${issue.path.join('/')}`,
                reason: issue.message,
              })),
            },
          },
          422,
        )
      return parsed.data
    }),
    async (c) => {
      const created = await c.var.eventService.create(c.req.valid('json'))
      c.header('Location', `/api/events/${created.eventId}`)
      return c.json(created, 201)
    },
  )
  .get('/:eventId', async (c) =>
    c.json(await c.var.eventService.get(c.req.param('eventId')), 200),
  )
  .patch(
    '/:eventId',
    validator('json', (body: unknown, c) => {
      const parsed = updateEventSchema.safeParse(body)
      if (!parsed.success)
        return c.json(
          {
            error: {
              code: 'invalid_input',
              message: '入力データが不正です。',
              details: parsed.error.issues.map((issue) => ({
                path: `/${issue.path.join('/')}`,
                reason: issue.message,
              })),
            },
          },
          422,
        )
      return parsed.data
    }),
    async (c) =>
      c.json(
        await c.var.eventService.update(
          c.req.param('eventId'),
          c.req.valid('json'),
        ),
        200,
      ),
  )
  .delete('/:eventId', async (c) => {
    await c.var.eventService.remove(c.req.param('eventId'))
    return c.body(null, 204)
  })
