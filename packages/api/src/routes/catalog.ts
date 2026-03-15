import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { services, specVersions } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'
import { sql } from 'drizzle-orm'

export const catalogRouter = new Hono()

catalogRouter.get('/api/catalog', jwtAuth, async (c) => {
  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      displayName: services.displayName,
      branch: specVersions.branch,
      endpointCount: specVersions.endpointCount,
      uploadedAt: specVersions.uploadedAt,
    })
    .from(services)
    .innerJoin(specVersions, sql`${specVersions.serviceId} = ${services.id} AND ${specVersions.isLatest} = true`)
    .orderBy(services.name, specVersions.branch)

  // Group by service
  const map = new Map<string, { id: string; name: string; displayName: string | null; branches: { branch: string; endpointCount: number; uploadedAt: Date }[] }>()
  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, { id: row.id, name: row.name, displayName: row.displayName, branches: [] })
    }
    map.get(row.id)!.branches.push({
      branch: row.branch,
      endpointCount: row.endpointCount,
      uploadedAt: row.uploadedAt,
    })
  }

  return c.json({ services: [...map.values()] })
})
