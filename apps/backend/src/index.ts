import { Hono } from 'hono'

import { apiDocs, openApiDocument } from './openapi'
import { eventRoutes } from './routes/events'

const app = new Hono<{ Bindings: CloudflareBindings }>()

export const routes = app
  .get('/api/health', (c) => c.json({ status: 'ok' }))
  .route('/api/events', eventRoutes)

export type AppType = typeof routes

app.get('/api/openapi.json', (c) => c.json(openApiDocument))
app.get('/api/docs', apiDocs)

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

export default app
