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

// /api/events 配下に登録するイベント本体API。
// 入出力の詳細・具体例は apps/backend/docs/api/events.md と openapi.json を参照。
export const eventRoutes = new Hono<EventEnv>()
  // 共通エラー：対象なし404、更新競合409、JSON構文不正400、DB・内部エラー500。
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
    // 認証導入前はサーバー設定の所有者IDを使い、未設定なら503を返す。
    // #57で認証済みユーザーIDへ置き換える。リクエストから所有者IDは受け取らない。
    const userId = c.env.EVENTS_USER_ID?.trim()
    if (!userId)
      return c.json(
        {
          error: {
            code: 'event_owner_not_configured',
            message: 'イベント所有者のサーバー設定が未完了です。',
            details: [],
          },
        },
        503,
      )
    c.set(
      'eventService',
      eventService(eventsRepository(createDb(c.env.DB)), userId),
    )
    await next()
  })
  // GET /api/events：対象所有者のイベント一覧を取得する。ボディなし。
  // 200：{ events: [...] }。削除済みを除き、更新日時の降順で返す。
  // 登録バンド数・配置済み数・空の部を含む部数を集計し、回答数は未対応のためnull。
  .get('/', async (c) =>
    c.json({ events: await c.var.eventService.list() }, 200),
  )
  // POST /api/events：イベント本体と空の第1部をまとめて作成する。
  // JSON入力：title必須、date・venue・descriptionは任意。初期状態はplanning。
  // 201：作成したイベント本体とLocationヘッダー。入力値不正は422。
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
  // GET /api/events/{eventId}：イベント本体の基本情報を取得する。ボディなし。
  // 200：ID・名称・状態・開催情報・作成/更新日時。表・制約・チャットは別APIで扱う。
  // 存在しない・削除済み・対象所有者以外のイベントは404。
  .get('/:eventId', async (c) =>
    c.json(await c.var.eventService.get(c.req.param('eventId')), 200),
  )
  // PATCH /api/events/{eventId}：イベント本体の設定を部分更新する。
  // JSON入力：expectedUpdatedAtと、title・date・venue・description・statusのいずれか。
  // 省略項目は保持し、任意項目はnullで消去する。取得後に更新済みなら409で保存しない。
  // 200：保存後のイベント本体（新しいupdatedAtを含む）。入力値不正は422。
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
  // DELETE /api/events/{eventId}：イベントを論理削除する。ボディなし。
  // is_deleted=1にし、配下の名簿・部・配置・希望・制約・チャット履歴は保持する。
  // 204：本文なし。通常の取得対象から外れ、削除済みIDへの再実行は404。
  .delete('/:eventId', async (c) => {
    await c.var.eventService.remove(c.req.param('eventId'))
    return c.body(null, 204)
  })
