import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { services, specVersions } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

export const catalogRouter = new OpenAPIHono()

catalogRouter.use('/api/catalog', jwtAuth)

const BranchSchema = z.object({
  branch: z.string(),
  endpointCount: z.number(),
  uploadedAt: z.string(),
})

const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().nullable(),
  branches: z.array(BranchSchema),
})

catalogRouter.openapi(createRoute({
  method: 'get',
  path: '/api/catalog',
  operationId: 'getCatalog',
  tags: ['Catalog'],
  summary: 'List all services and their branches',
  description: 'Returns all services with their branches and latest endpoint counts.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ services: z.array(ServiceSchema) }) } },
      description: 'Service catalog',
    },
  },
}), async (c) => {
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

  const map = new Map<string, { id: string; name: string; displayName: string | null; branches: { branch: string; endpointCount: number; uploadedAt: Date }[] }>()
  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, { id: row.id, name: row.name, displayName: row.displayName, branches: [] })
    }
    map.get(row.id)!.branches.push({ branch: row.branch, endpointCount: row.endpointCount, uploadedAt: row.uploadedAt })
  }

  return c.json({ services: [...map.values()] }, 200 as const)
})
