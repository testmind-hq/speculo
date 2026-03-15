import { serve } from '@hono/node-server'
import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
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

const app = new OpenAPIHono()

// Register security scheme in the registry
app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT or MCP Token',
})

app.use('*', logger())
app.use('/api/*', cors())
app.use('/auth/*', cors())

app.route('/', authRouter)
app.route('/', uploadRouter)
app.route('/', catalogRouter)
app.route('/', specsRouter)
app.route('/', searchRouter)
app.route('/', docsRouter)
app.route('/', llmsRouter)
app.route('/', mcpRouter)

// OpenAPI spec endpoint
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Speculo API',
    version: '0.1.0',
    description: 'Self-hosted internal API documentation platform with MCP support',
  },
})

// Scalar UI
app.get('/api-docs', Scalar({ url: '/openapi.json', theme: 'purple' }))

app.get('/', (c) => c.json({ name: 'Speculo API', version: '0.1.0' }))

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`Speculo API running on http://localhost:${env.PORT}`)
  console.log(`API docs: http://localhost:${env.PORT}/api-docs`)
})

export default app
