import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './env.js'
import { runStartup } from './startup.js'
import { authRouter } from './routes/auth.js'
import { uploadRouter } from './routes/upload.js'
import { catalogRouter } from './routes/catalog.js'
import { specsRouter } from './routes/specs.js'
import { searchRouter } from './routes/search.js'
import { docsRouter } from './routes/docs.js'
import { llmsRouter } from './routes/llms.js'
import { mcpRouter } from './mcp/transport.js'
import { adminRouter } from './routes/admin.js'

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
app.route('/', adminRouter)

// OpenAPI spec endpoint
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Speculo API',
    version: '0.1.0',
    description: 'Self-hosted internal API documentation platform with MCP support',
    contact: { name: 'Speculo', url: 'https://github.com/yuchou87/speculo' },
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Auth', description: 'Authentication and account management' },
    { name: 'MCP Tokens', description: 'MCP token lifecycle management' },
    { name: 'Upload', description: 'OpenAPI spec upload and indexing' },
    { name: 'Catalog', description: 'Service and branch discovery' },
    { name: 'Specs', description: 'Raw OpenAPI spec access' },
    { name: 'Search', description: 'Full-text endpoint search' },
    { name: 'Admin', description: 'Team, user, and grant management (super_admin / team_owner)' },
  ],
})

// Scalar UI
app.get('/api-docs', Scalar({ url: '/openapi.json', theme: 'purple' }))

// Serve React SPA static files (production build at ./public)
app.use('*', serveStatic({ root: './public' }))
app.use('*', serveStatic({ path: 'index.html', root: './public' }))

runStartup().then(() => {
  serve({ fetch: app.fetch, port: env.PORT }, () => {
    console.log(`Speculo running on http://localhost:${env.PORT}`)
    console.log(`API docs: http://localhost:${env.PORT}/api-docs`)
  })
}).catch((err) => {
  console.error('Startup failed:', err)
  process.exit(1)
})

export default app
