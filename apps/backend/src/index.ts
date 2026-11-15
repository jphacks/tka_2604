import { Hono } from 'hono'
import { TrieRouter } from 'hono/router/trie-router'

import { createDb } from './db/index'
import { apiDocs, openApiDocument } from './openapi'
import { formRepository } from './repositories/form'
import { authRoutes } from './routes/auth'
import { type AuthEnv, protectApi } from './routes/auth-security'
import { chatRoutes } from './routes/chat-worker'
import { eventRoutes } from './routes/events'
import { createFormRoutes } from './routes/form'
import { formService } from './services/form/service'

const formRoutes = createFormRoutes<CloudflareBindings>((bindings) =>
  formService(formRepository(createDb(bindings.DB))),
)

// Keep wildcard authentication on paths containing encoded line terminators.
const app = new Hono<AuthEnv>({ router: new TrieRouter() })
app.use('/api/*', protectApi)

export const routes = app
  .get('/api/health', (c) => c.json({ status: 'ok' }))
  .route('/api/auth', authRoutes)
  .route('/api/events', formRoutes)
  .route('/api/events', chatRoutes)
  .route('/api/events', eventRoutes)

export type AppType = typeof routes

app.get('/api/openapi.json', (c) => c.json(openApiDocument))
app.get('/api/docs', apiDocs)

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

export default app
