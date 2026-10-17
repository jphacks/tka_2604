import type { SolverClient } from '../services/solver/contract'
import { SolverError } from '../services/solver/errors'

export const SOLVER_TIMEOUT_MS = 30_000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

export function solverClient(
  config: { url?: string; token?: string },
  send: typeof fetch = fetch,
  timeoutMs = SOLVER_TIMEOUT_MS,
): SolverClient {
  return async (input) => {
    let url: URL
    try {
      if (!config.url || !config.token) throw new Error('missing configuration')
      url = new URL(config.url)
      if (
        url.username ||
        url.password ||
        (url.protocol !== 'https:' &&
          !(
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
          ))
      )
        throw new Error('invalid URL')
      url.pathname = `${url.pathname.replace(/\/$/, '')}/solve`
      url.search = ''
      url.hash = ''
    } catch {
      throw new SolverError('solver_unavailable')
    }
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new SolverError('solver_timeout'))
      }, timeoutMs)
    })
    async function receive() {
      const response = await send(url.toString(), {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new SolverError('solver_upstream_error')
      }
      if (!response.body) throw new SolverError('solver_invalid_response')
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      const abort = () => {
        void reader.cancel().catch(() => undefined)
      }
      controller.signal.addEventListener('abort', abort, { once: true })
      try {
        while (true) {
          const chunk: ReadableStreamReadResult<unknown> = await reader.read()
          if (chunk.done) break
          if (!(chunk.value instanceof Uint8Array))
            throw new SolverError('solver_invalid_response')
          size += chunk.value.byteLength
          if (size > MAX_RESPONSE_BYTES) {
            await reader.cancel()
            throw new SolverError('solver_invalid_response')
          }
          chunks.push(chunk.value)
        }
      } finally {
        controller.signal.removeEventListener('abort', abort)
        reader.releaseLock()
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      try {
        return JSON.parse(new TextDecoder().decode(bytes)) as unknown
      } catch {
        throw new SolverError('solver_invalid_response')
      }
    }
    try {
      return await Promise.race([receive(), deadline])
    } catch (error) {
      if (controller.signal.aborted) throw new SolverError('solver_timeout')
      if (error instanceof SolverError) throw error
      throw new SolverError('solver_upstream_error')
    } finally {
      clearTimeout(timer)
    }
  }
}
