import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { sql, and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { endpointIndex } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

export const searchRouter = new OpenAPIHono()

searchRouter.use('/api/search', jwtAuth)

const EndpointResultSchema = z.object({
  method: z.string(),
  path: z.string(),
  summary: z.string().nullable(),
  operationId: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  serviceName: z.string(),
  branch: z.string(),
})

searchRouter.openapi(createRoute({
  method: 'get',
  path: '/api/search',
  operationId: 'searchEndpoints',
  tags: ['Search'],
  summary: 'Search endpoints across all services',
  description: 'Full-text search across endpoint paths, summaries, and operationIds. Returns up to 10 results.',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      q: z.string().min(1).openapi({ description: 'Search query' }),
      service: z.string().optional().openapi({ description: 'Filter by service name' }),
      branch: z.string().optional().openapi({ description: 'Filter by branch' }),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ results: z.array(EndpointResultSchema) }) } }, description: 'Search results (max 10)' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Missing query parameter' },
  },
}), async (c) => {
  const { q, service, branch } = c.req.valid('query')

  if (!q?.trim()) return c.json({ error: 'Missing query parameter q' }, 400 as const)

  // Use tsvector full-text search when search_vector column is populated; fall back to ILIKE
  const tsQuery = q.trim().split(/\s+/).filter(Boolean).join(' & ')
  const conditions = [
    sql`(
      (${endpointIndex.searchVector} @@ to_tsquery('english', ${tsQuery}))
      OR
      (${endpointIndex.path} ILIKE ${'%' + q + '%'}
        OR ${endpointIndex.summary} ILIKE ${'%' + q + '%'}
        OR ${endpointIndex.operationId} ILIKE ${'%' + q + '%'})
    )`,
  ]
  if (service) conditions.push(eq(endpointIndex.serviceName, service))
  if (branch) conditions.push(eq(endpointIndex.branch, branch))

  const results = await db
    .select({
      method: endpointIndex.method,
      path: endpointIndex.path,
      summary: endpointIndex.summary,
      operationId: endpointIndex.operationId,
      tags: endpointIndex.tags,
      serviceName: endpointIndex.serviceName,
      branch: endpointIndex.branch,
    })
    .from(endpointIndex)
    .where(and(...conditions))
    .limit(10)

  return c.json({ results }, 200 as const)
})
