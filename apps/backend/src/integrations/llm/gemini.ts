import {
  type GenerateContentParameters,
  type GenerateContentResponse,
  GoogleGenAI,
} from '@google/genai/web'
import { z } from 'zod'

import { AIChatError } from '../../services/chat/errors.ts'
import { AI_CHAT_SYSTEM_INSTRUCTIONS } from '../../services/chat/prompt.ts'
import type { AIChatInput, ChatModel } from '../../services/chat/types.ts'
import { geminiOutputJsonSchema } from './gemini-schema.ts'

export const GEMINI_CHAT_MODEL = 'gemini-3.5-flash-lite'

export function buildGeminiRequest(input: AIChatInput) {
  return {
    model: GEMINI_CHAT_MODEL,
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
    config: {
      systemInstruction: AI_CHAT_SYSTEM_INSTRUCTIONS,
      responseMimeType: 'application/json',
      responseJsonSchema: geminiOutputJsonSchema,
    },
  } satisfies GenerateContentParameters
}

type Options = {
  apiKey: string
  fetch?: typeof fetch
  timeoutMs?: number
}

const envelopeSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({
            role: z.string(),
            parts: z.array(
              z
                .object({
                  text: z.string().optional(),
                  thought: z.boolean().optional(),
                  thoughtSignature: z.string().optional(),
                })
                .passthrough(),
            ),
          })
          .optional(),
      }),
    )
    .optional(),
})

async function readResponse(response: Response): Promise<unknown> {
  if (!response.body) throw new AIChatError('ai_chat_invalid_provider_response')
  const reader = (response.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 1024 * 1024) {
        await reader.cancel()
        throw new AIChatError('ai_chat_invalid_provider_response')
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
    return JSON.parse(text + decoder.decode()) as unknown
  } catch (error) {
    if (error instanceof AIChatError) throw error
    throw new AIChatError('ai_chat_invalid_provider_response')
  } finally {
    reader.releaseLock()
  }
}

function extractOutput(response: GenerateContentResponse): unknown {
  const parsed = envelopeSchema.safeParse(response)
  if (!parsed.success)
    throw new AIChatError('ai_chat_invalid_provider_response')
  const blockReason = parsed.data.promptFeedback?.blockReason
  if (blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED')
    throw new AIChatError('ai_chat_refused')
  if (parsed.data.candidates?.length !== 1)
    throw new AIChatError('ai_chat_invalid_provider_response')
  const candidate = parsed.data.candidates[0]
  if (
    [
      'SAFETY',
      'RECITATION',
      'BLOCKLIST',
      'PROHIBITED_CONTENT',
      'SPII',
      'IMAGE_SAFETY',
      'IMAGE_PROHIBITED_CONTENT',
      'IMAGE_RECITATION',
    ].includes(candidate.finishReason ?? '')
  )
    throw new AIChatError('ai_chat_refused')
  if (candidate.finishReason !== 'STOP')
    throw new AIChatError('ai_chat_incomplete_response')
  if (
    candidate.content?.role !== 'model' ||
    candidate.content.parts.some(
      (part) =>
        Object.keys(part).some(
          (key) => !['text', 'thought', 'thoughtSignature'].includes(key),
        ) ||
        (part.thought !== true && part.text === undefined),
    )
  )
    throw new AIChatError('ai_chat_invalid_provider_response')
  const text = response.text
  if (!text?.trim()) throw new AIChatError('ai_chat_invalid_provider_response')
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new AIChatError('ai_chat_invalid_provider_response')
  }
}

export function createGeminiChatModel(options: Options): ChatModel {
  if (!options.apiKey.trim()) throw new AIChatError('ai_chat_missing_api_key')
  const fetcher = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 60_000
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new AIChatError('ai_chat_invalid_timeout')
  const ai = new GoogleGenAI({
    apiKey: options.apiKey,
    vertexai: false,
    httpOptions: {
      apiVersion: 'v1beta',
      retryOptions: { attempts: 1 },
      fetch: async (url, init) => {
        const response = await fetcher(url, init)
        if (!response.ok) {
          await response.body?.cancel()
          throw new AIChatError('ai_chat_provider_error')
        }
        // Bound and parse the wire response before the SDK consumes its JSON body.
        return Response.json(await readResponse(response))
      },
    },
  })
  return async (input) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const request = buildGeminiRequest(input)
      const response = await ai.models.generateContent({
        ...request,
        config: { ...request.config, abortSignal: controller.signal },
      })
      return extractOutput(response)
    } catch (error) {
      if (controller.signal.aborted) throw new AIChatError('ai_chat_timeout')
      if (error instanceof AIChatError) throw error
      // Provider bodies, request data and credentials must not enter application errors.
      throw new AIChatError('ai_chat_provider_error')
    } finally {
      clearTimeout(timer)
    }
  }
}
