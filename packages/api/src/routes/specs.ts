import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { services, specVersions } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'
import { canAccessService } from '../services/permissions.js'

export const specsRouter = new OpenAPIHono()

specsRouter.use('/api/specs/*', jwtAuth)

specsRouter.openapi(createRoute({
  method: 'get',
  path: '/api/specs/{service}/{branch}/openapi.json',
  operationId: 'getSpec',
  tags: ['Specs'],
  summary: 'Get the raw OpenAPI JSON for a service branch',
  description: 'Returns the latest normalized OpenAPI 3.x document for the given service and branch.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ service: z.string(), branch: z.string() }),
  },
  responses: {
    200: { content: { 'application/json': { schema: z.record(z.any()) } }, description: 'OpenAPI document' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  },
}), async (c) => {
  const { service, branch } = c.req.valid('param')

  const accessible = await canAccessService(c.get('userId'), c.get('userRole'), service, branch)
  if (!accessible) return c.json({ error: 'Forbidden' }, 403 as const)

  const [row] = await db
    .select({ specContent: specVersions.specContent })
    .from(specVersions)
    .innerJoin(services, eq(specVersions.serviceId, services.id))
    .where(sql`${services.name} = ${service} AND ${specVersions.branch} = ${branch} AND ${specVersions.isLatest} = true`)

  if (!row) return c.json({ error: 'Not found' }, 404 as const)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.json(JSON.parse(row.specContent) as any, 200 as const)
})
