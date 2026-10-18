import { describe, expect, it, vi } from 'vitest'

import { loadEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import { authSessions, chatMessages, events, users } from '../../src/db/schema'
import app from '../../src/index'
import { createAuthenticatedHeaders } from '../helpers/auth'
import { testDatabase } from '../helpers/database'
import { seedEventInformation } from '../helpers/event-information'

const protectedOperations = [
  ['GET', '/api/events'],
  ['POST', '/api/events'],
  ['GET', '/api/events/event-a'],
  ['PATCH', '/api/events/event-a'],
  ['DELETE', '/api/events/event-a'],
  ['DELETE', '/api/events/event-a/bands/band-a'],
  ['GET', '/api/events/event-a/schedule'],
  ['POST', '/api/events/event-a/schedule'],
  ['GET', '/api/events/event-a/constraints'],
  ['POST', '/api/events/event-a/constraints'],
  ['GET', '/api/events/event-a/chat'],
  ['POST', '/api/events/event-a/chat'],
  ['POST', '/api/events/event-a/solve'],
] as const

describe('authentication before protected operations', () => {
  it.each(protectedOperations)(
    '%s %s refuses an anonymous request before touching a binding or external service',
    async (method, path) => {
      const external = vi.spyOn(globalThis, 'fetch')
      try {
        // No DB/LLM/Solver bindings: unauthorized requests must stop before
        // service construction, input handling or business-data access.
        const response = await app.request(path, { method })
        expect(response.status).toBe(401)
        expect(await response.json()).toMatchObject({
          error: { code: 'unauthorized' },
        })
        expect(external).not.toHaveBeenCalled()
      } finally {
        external.mockRestore()
      }
    },
  )

  it('rejects unknown, expired and revoked tokens across every protected operation without side effects', async () => {
    const local = await testDatabase()
    const db = createDb(local.binding)
    try {
      await db.insert(users).values({
        userId: 'demo-owner',
        passwordHash: 'test-only',
      })
      const seed = await seedEventInformation(db)
      const expired = await createAuthenticatedHeaders(local.binding)
      await db.update(authSessions).set({ expiresAt: Date.now() - 1 })
      const revoked = await createAuthenticatedHeaders(local.binding)
      const logout = await app.request(
        '/api/auth/logout',
        { method: 'POST', headers: revoked },
        { DB: local.binding },
      )
      expect(logout.status).toBe(204)
      const unknown = {
        Cookie: `setly_session=${'a'.repeat(64)}`,
        Origin: 'http://localhost',
      }
      const before = await loadEvent(db, 'demo-owner', seed.event.eventId)
      const eventsBefore = await db.select().from(events)
      const messagesBefore = await db.select().from(chatMessages)
      const external = vi.spyOn(globalThis, 'fetch')
      try {
        for (const [state, headers] of [
          ['unknown', unknown],
          ['expired', expired],
          ['revoked', revoked],
        ] as const) {
          for (const [method, template] of protectedOperations) {
            const path = template
              .replace('event-a', seed.event.eventId)
              .replace('band-a', 'a-b1')
            const response = await app.request(
              path,
              {
                method,
                headers: { ...headers, 'Content-Type': 'application/json' },
                ...(method === 'GET'
                  ? {}
                  : { body: JSON.stringify({ title: 'Unauthorized change' }) }),
              },
              { DB: local.binding },
            )
            expect(response.status, `${state}: ${method} ${path}`).toBe(401)
            expect(await response.json()).toMatchObject({
              error: { code: 'unauthorized' },
            })
          }
        }
        expect(external).not.toHaveBeenCalled()
        expect(await loadEvent(db, 'demo-owner', seed.event.eventId)).toEqual(
          before,
        )
        expect(await db.select().from(events)).toEqual(eventsBefore)
        expect(await db.select().from(chatMessages)).toEqual(messagesBefore)
      } finally {
        external.mockRestore()
      }
    } finally {
      await local.dispose()
    }
  })
})
