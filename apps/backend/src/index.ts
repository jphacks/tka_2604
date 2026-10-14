import { Hono } from 'hono'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

export default app
