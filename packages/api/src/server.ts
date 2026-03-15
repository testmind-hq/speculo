import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './env.js'
import { authRouter } from './routes/auth.js'
import { uploadRouter } from './routes/upload.js'
import { catalogRouter } from './routes/catalog.js'
import { specsRouter } from './routes/specs.js'
import { searchRouter } from './routes/search.js'
import { docsRouter } from './routes/docs.js'
import { llmsRouter } from './routes/llms.js'
import { mcpRouter } from './mcp/transport.js'

const app = new Hono()

app.use('*', logger())
app.use('/api/*', cors())
app.use('/auth/*', cors())

// Mount all routers
app.route('/', authRouter)
app.route('/', uploadRouter)
app.route('/', catalogRouter)
app.route('/', specsRouter)
app.route('/', searchRouter)
app.route('/', docsRouter)   // /docs/:service/:branch (JWT protected)
app.route('/', llmsRouter)   // /docs/:service/:branch/llms.txt (public)
app.route('/', mcpRouter)    // /mcp (MCP token)

app.get('/', (c) => c.json({ name: 'Speculo API', version: '0.1.0' }))

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`Speculo API running on http://localhost:${env.PORT}`)
})

export default app
