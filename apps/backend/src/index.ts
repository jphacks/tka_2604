import { Hono } from 'hono'

import { apiDocs, openApiDocument } from './openapi'

const app = new Hono<{ Bindings: CloudflareBindings }>()

export const routes = app.get('/api/health', (c) => c.json({ status: 'ok' }))

export type AppType = typeof routes

app.get('/api/openapi.json', (c) => c.json(openApiDocument))
app.get('/api/docs', apiDocs)

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

export default app
