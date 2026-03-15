import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { services, specVersions } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

export const specsRouter = new Hono()

specsRouter.get('/api/specs/:service/:branch/openapi.json', jwtAuth, async (c) => {
  const { service, branch } = c.req.param()

  const [row] = await db
    .select({ specContent: specVersions.specContent })
    .from(specVersions)
    .innerJoin(services, eq(specVersions.serviceId, services.id))
    .where(sql`${services.name} = ${service} AND ${specVersions.branch} = ${branch} AND ${specVersions.isLatest} = true`)

  if (!row) return c.json({ error: 'Not found' }, 404)

  return c.json(JSON.parse(row.specContent))
})
