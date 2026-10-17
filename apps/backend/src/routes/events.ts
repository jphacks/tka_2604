import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'
import type { z } from 'zod'

import { createDb } from '../db/index'
import { eventsRepository } from '../repositories/events'
import { schedulingRepository } from '../repositories/scheduling'
import { EventError } from '../services/events/errors'
import { eventService } from '../services/events/service'
import {
  createEventSchema,
  updateEventSchema,
} from '../services/events/validation'
import { SchedulingError } from '../services/scheduling/errors'
import { schedulingService } from '../services/scheduling/service'
import {
  saveConstraintsSchema,
  saveScheduleSchema,
} from '../services/scheduling/validation'

type EventEnv = {
  Bindings: CloudflareBindings
  Variables: {
    eventService: ReturnType<typeof eventService>
    scheduling: ReturnType<typeof schedulingService>
  }
}

function jsonInput<T extends z.ZodType>(schema: T) {
  return validator('json', (value: unknown) => {
    const parsed = schema.safeParse(value)
    if (!parsed.success)
      throw new SchedulingError(
        'invalid_input',
        parsed.error.issues.map((issue) => ({
          path: `/${issue.path.join('/')}`,
          reason: issue.message,
        })),
      )
    return parsed.data
  })
}

export const eventRoutes = new Hono<EventEnv>()
  .onError((error, c) => {
    if (error instanceof SchedulingError) {
      const status =
        error.code === 'event_not_found'
          ? 404
          : error.code === 'event_save_conflict'
            ? 409
            : 422
      return c.json(
        {
          error: {
            code: error.code,
            message:
              'イベントの処理に失敗しました。入力と最新の状態を確認してください。',
            details: error.details,
          },
        },
        status,
      )
    }
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
    const db = createDb(c.env.DB)
    const scheduling = schedulingRepository(db)
    c.set('eventService', eventService(eventsRepository(db), userId))
    c.set('scheduling', schedulingService(scheduling, userId))
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
  .get('/:eventId/schedule', async (c) =>
    c.json(await c.var.eventService.getSchedule(c.req.param('eventId')), 200),
  )
  .get('/:eventId/constraints', async (c) =>
    c.json(
      await c.var.eventService.getConstraints(c.req.param('eventId')),
      200,
    ),
  )
  .get('/:eventId/chat', async (c) =>
    c.json(await c.var.eventService.getChat(c.req.param('eventId')), 200),
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
  .post('/:eventId/schedule', jsonInput(saveScheduleSchema), async (c) =>
    c.json(
      await c.var.scheduling.saveSchedule(
        c.req.param('eventId'),
        c.req.valid('json'),
      ),
      200,
    ),
  )
  .post('/:eventId/constraints', jsonInput(saveConstraintsSchema), async (c) =>
    c.json(
      await c.var.scheduling.saveConstraints(
        c.req.param('eventId'),
        c.req.valid('json'),
      ),
      200,
    ),
  )
