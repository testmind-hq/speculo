import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { sql, and, eq, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { endpointIndex, services } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'
import { getAccessibleServiceIds } from '../services/permissions.js'

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
  summary: 'Search endpoints across accessible services',
  description: 'Full-text search across endpoint paths, summaries, and operationIds. Results are scoped to services the authenticated user can access. Returns up to 10 results.',
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

  // Permission scoping: resolve accessible service names for non-super_admin users
  const accessibleIds = await getAccessibleServiceIds(c.get('userId'), c.get('userRole'))
  if (accessibleIds !== null && accessibleIds.size === 0) {
    return c.json({ results: [] }, 200 as const)
  }

  // Use tsvector full-text search with websearch_to_tsquery (safe for arbitrary user input,
  // handles punctuation and stop-words gracefully without throwing). Fall back to ILIKE so
  // rows inserted before the search_vector trigger also match.
  const conditions = [
    sql`(
      (${endpointIndex.searchVector} @@ websearch_to_tsquery('english', ${q}))
      OR
      (${endpointIndex.path} ILIKE ${'%' + q + '%'}
        OR ${endpointIndex.summary} ILIKE ${'%' + q + '%'}
        OR ${endpointIndex.operationId} ILIKE ${'%' + q + '%'})
    )`,
  ]

  if (accessibleIds !== null) {
    // Map accessible service IDs → names (endpointIndex stores serviceName, not serviceId)
    const nameRows = await db
      .select({ name: services.name })
      .from(services)
      .where(inArray(services.id, [...accessibleIds]))
    conditions.push(inArray(endpointIndex.serviceName, nameRows.map(r => r.name)))
  }

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
