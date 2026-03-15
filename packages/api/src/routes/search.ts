import { Hono } from 'hono'
import { sql, and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { endpointIndex } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

export const searchRouter = new Hono()

searchRouter.get('/api/search', jwtAuth, async (c) => {
  const q = c.req.query('q')
  const service = c.req.query('service')
  const branch = c.req.query('branch')

  if (!q?.trim()) return c.json({ error: 'Missing query parameter q' }, 400)

  const pattern = `%${q}%`

  const conditions = [
    sql`(${endpointIndex.path} ILIKE ${pattern} OR ${endpointIndex.summary} ILIKE ${pattern} OR ${endpointIndex.operationId} ILIKE ${pattern})`,
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

  return c.json({ results })
})
