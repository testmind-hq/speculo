import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq, sql, inArray, or, isNull, gt, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { services, specVersions, teams, teamMembers, crossTeamGrants } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

export const catalogRouter = new OpenAPIHono()

catalogRouter.use('/api/catalog', jwtAuth)
catalogRouter.use('/api/catalog/:serviceId', jwtAuth)

const BranchSchema = z.object({
  branch: z.string(),
  endpointCount: z.number(),
  uploadedAt: z.string(),
})

const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().nullable(),
  teamId: z.string().nullable(),
  teamName: z.string().nullable(),
  branches: z.array(BranchSchema),
})

catalogRouter.openapi(createRoute({
  method: 'get',
  path: '/api/catalog',
  operationId: 'getCatalog',
  tags: ['Catalog'],
  summary: 'List all services and their branches',
  description: 'Returns services accessible to the authenticated user with their branches and team assignments.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ services: z.array(ServiceSchema) }) } },
      description: 'Service catalog',
    },
  },
}), async (c) => {
  const userId = c.get('userId')
  const userRole = c.get('userRole')

  // Build a set of accessible service IDs based on role
  let accessibleServiceIds: Set<string> | null = null // null = all services

  if (userRole !== 'super_admin') {
    // Fetch user's team memberships
    const userTeamRows = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
    const userTeamIds = userTeamRows.map(r => r.teamId)

    // Services owned by user's teams
    const ownedServices = userTeamIds.length > 0
      ? await db
        .select({ id: services.id })
        .from(services)
        .where(inArray(services.teamId, userTeamIds))
      : []

    // Services granted to the user's teams or directly to the user
    const grantedServices = await db
      .select({ serviceId: crossTeamGrants.serviceId })
      .from(crossTeamGrants)
      .where(and(
        or(
          userTeamIds.length > 0 ? inArray(crossTeamGrants.granteeTeamId, userTeamIds) : sql`false`,
          eq(crossTeamGrants.granteeUserId, userId),
        ),
        or(isNull(crossTeamGrants.expiresAt), gt(crossTeamGrants.expiresAt, new Date())),
      ))

    accessibleServiceIds = new Set([
      ...ownedServices.map(s => s.id),
      ...grantedServices.map(g => g.serviceId),
    ])
  }

  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      displayName: services.displayName,
      teamId: services.teamId,
      teamName: teams.name,
      branch: specVersions.branch,
      endpointCount: specVersions.endpointCount,
      uploadedAt: specVersions.uploadedAt,
    })
    .from(services)
    .leftJoin(teams, eq(teams.id, services.teamId))
    .innerJoin(specVersions, sql`${specVersions.serviceId} = ${services.id} AND ${specVersions.isLatest} = true`)
    .orderBy(services.name, specVersions.branch)

  const map = new Map<string, {
    id: string
    name: string
    displayName: string | null
    teamId: string | null
    teamName: string | null
    branches: { branch: string; endpointCount: number; uploadedAt: Date }[]
  }>()

  for (const row of rows) {
    // Filter by accessible service IDs for non-super_admin users
    if (accessibleServiceIds && !accessibleServiceIds.has(row.id)) continue

    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id,
        name: row.name,
        displayName: row.displayName,
        teamId: row.teamId,
        teamName: row.teamName ?? null,
        branches: [],
      })
    }
    map.get(row.id)!.branches.push({ branch: row.branch, endpointCount: row.endpointCount, uploadedAt: row.uploadedAt })
  }

  return c.json({ services: [...map.values()] }, 200 as const)
})

catalogRouter.openapi(createRoute({
  method: 'delete',
  path: '/api/catalog/:serviceId',
  operationId: 'deleteService',
  tags: ['Catalog'],
  summary: 'Delete a service and all its specs (super_admin only)',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ serviceId: z.string().uuid() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Deleted' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  },
}), async (c) => {
  if (c.get('userRole') !== 'super_admin') {
    return c.json({ error: 'Forbidden' }, 403 as const)
  }
  const { serviceId } = c.req.valid('param')
  const existing = await db.query.services.findFirst({ where: eq(services.id, serviceId) })
  if (!existing) return c.json({ error: 'Service not found' }, 404 as const)
  await db.delete(services).where(eq(services.id, serviceId))
  return c.json({ ok: true }, 200 as const)
})
