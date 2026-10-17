import { type Context, Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'
import { z } from 'zod'

import { AIChatError, ChatMessageError } from '../services/chat/errors'
import { EventError } from '../services/events/errors'

const chatRequest = z.strictObject({
  message: z.string().max(1000).trim().min(1),
  messageId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
})

export function createChatRoutes<Bindings extends object>(
  send: (
    eventId: string,
    input: { messageId: string; message: string },
    bindings: Bindings,
  ) => Promise<{ reply: string }>,
) {
  return new Hono<{ Bindings: Bindings }>()
    .onError((error, c) => {
      if (error instanceof ChatMessageError)
        return c.json(
          {
            error: {
              code: error.code,
              message: '発言IDが別の本文または会話に使われています。',
              details: [],
            },
          },
          409,
        )
      if (
        error instanceof AIChatError &&
        error.code !== 'ai_chat_missing_api_key' &&
        error.code !== 'ai_chat_invalid_input' &&
        error.code !== 'ai_chat_invalid_timeout'
      )
        return c.json(
          {
            error: {
              code: 'ai_chat_failed',
              message:
                'AIの応答を取得できませんでした。同じ発言IDで再試行してください。',
              details: [],
            },
          },
          error.code === 'ai_chat_timeout' ? 504 : 502,
        )
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
            message: 'チャットの応答に失敗しました。',
            details: [],
          },
        },
        500,
      )
    })
    .post(
      '/:eventId/chat',
      validator('json', (value: unknown, c) => {
        const parsed = chatRequest.safeParse(value)
        if (!parsed.success) {
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
        }
        return parsed.data
      }),
      async (
        c: Context<
          { Bindings: Bindings },
          '/:eventId/chat',
          {
            in: { json: z.input<typeof chatRequest> }
            out: { json: z.output<typeof chatRequest> }
          }
        >,
      ) => {
        const input = c.req.valid('json')
        const messageId = input.messageId ?? crypto.randomUUID()
        c.header('X-Chat-Message-Id', messageId)
        const result = await send(
          c.req.param('eventId'),
          {
            messageId,
            message: input.message,
          },
          c.env,
        )
        return c.json(result)
      },
    )
}

// The public route shape has no dependency on D1 or generated Worker globals.
export type ChatAppType = ReturnType<typeof createChatRoutes>
