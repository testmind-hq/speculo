import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq, and, sql } from 'drizzle-orm'
import { hash } from 'bcryptjs'
import { db } from '../db/index.js'
import { users, teams, teamMembers, services, crossTeamGrants } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

export const adminRouter = new OpenAPIHono()

// ── Auth middleware ────────────────────────────────────────────────────────────
adminRouter.use('/api/admin/*', jwtAuth)

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSuperAdmin(c: { get: (k: string) => string }): boolean {
  return (c.get('userRole') as string) === 'super_admin'
}

function isTeamOwnerOrAdmin(role: string): boolean {
  return role === 'super_admin' || role === 'team_owner'
}

// ── Teams ─────────────────────────────────────────────────────────────────────

const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().nullable(),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  isDeletable: z.boolean(),
  createdAt: z.string(),
})

adminRouter.openapi(createRoute({
  method: 'get',
  path: '/api/admin/teams',
  operationId: 'listTeams',
  tags: ['Admin'],
  summary: 'List all teams',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { 'application/json': { schema: z.object({ teams: z.array(TeamSchema) }) } }, description: 'Team list' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (!isSuperAdmin(c)) return c.json({ error: 'Forbidden' }, 403 as const)
  const rows = await db.select().from(teams).orderBy(teams.name)
  return c.json({ teams: rows.map(t => ({ ...t, createdAt: t.createdAt.toISOString() })) }, 200 as const)
})

adminRouter.openapi(createRoute({
  method: 'post',
  path: '/api/admin/teams',
  operationId: 'createTeam',
  tags: ['Admin'],
  summary: 'Create a team',
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: z.object({ name: z.string().min(1), displayName: z.string().optional(), description: z.string().optional() }) } }, required: true },
  },
  responses: {
    200: { content: { 'application/json': { schema: TeamSchema } }, description: 'Team created' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
    409: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Name taken' },
  },
}), async (c) => {
  if (!isSuperAdmin(c)) return c.json({ error: 'Forbidden' }, 403 as const)
  const { name, displayName, description } = c.req.valid('json')
  const existing = await db.query.teams.findFirst({ where: eq(teams.name, name) })
  if (existing) return c.json({ error: 'Team name already taken' }, 409 as const)
  const userId = c.get('userId')
  const [team] = await db.insert(teams).values({ name, displayName, description, createdBy: userId }).returning()
  return c.json({ ...team, createdAt: team.createdAt.toISOString() }, 200 as const)
})

adminRouter.openapi(createRoute({
  method: 'put',
  path: '/api/admin/teams/{id}',
  operationId: 'updateTeam',
  tags: ['Admin'],
  summary: 'Rename a team',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ displayName: z.string().optional(), description: z.string().optional() }) } }, required: true },
  },
  responses: {
    200: { content: { 'application/json': { schema: TeamSchema } }, description: 'Updated' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  },
}), async (c) => {
  if (!isSuperAdmin(c)) return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const [updated] = await db.update(teams).set(body).where(eq(teams.id, id)).returning()
  if (!updated) return c.json({ error: 'Team not found' }, 404 as const)
  return c.json({ ...updated, createdAt: updated.createdAt.toISOString() }, 200 as const)
})

adminRouter.openapi(createRoute({
  method: 'delete',
  path: '/api/admin/teams/{id}',
  operationId: 'deleteTeam',
  tags: ['Admin'],
  summary: 'Delete a team',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Deleted' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  },
}), async (c) => {
  if (!isSuperAdmin(c)) return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')
  const team = await db.query.teams.findFirst({ where: eq(teams.id, id) })
  if (!team) return c.json({ error: 'Team not found' }, 404 as const)
  if (!team.isDeletable) return c.json({ error: 'Default team cannot be deleted' }, 403 as const)
  await db.delete(teams).where(eq(teams.id, id))
  return c.json({ ok: true }, 200 as const)
})

// ── Team Members ──────────────────────────────────────────────────────────────

const MemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  email: z.string(),
  role: z.enum(['owner', 'member']),
  joinedAt: z.string(),
})

adminRouter.openapi(createRoute({
  method: 'get',
  path: '/api/admin/teams/{id}/members',
  operationId: 'listTeamMembers',
  tags: ['Admin'],
  summary: 'List team members',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ members: z.array(MemberSchema) }) } }, description: 'Members' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (!isTeamOwnerOrAdmin(c.get('userRole'))) return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')
  const rows = await db
    .select({ id: teamMembers.id, userId: teamMembers.userId, email: users.email, role: teamMembers.role, joinedAt: teamMembers.joinedAt })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, id))
    .orderBy(users.email)
  return c.json({ members: rows.map(r => ({ ...r, joinedAt: r.joinedAt.toISOString() })) }, 200 as const)
})

adminRouter.openapi(createRoute({
  method: 'post',
  path: '/api/admin/teams/{id}/members',
  operationId: 'addTeamMember',
  tags: ['Admin'],
  summary: 'Add a user to a team',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ userId: z.string(), role: z.enum(['owner', 'member']).default('member') }) } }, required: true },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Added' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
    409: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Already member' },
  },
}), async (c) => {
  if (!isTeamOwnerOrAdmin(c.get('userRole'))) return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')
  const { userId, role } = c.req.valid('json')
  const existing = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, id), eq(teamMembers.userId, userId)),
  })
  if (existing) return c.json({ error: 'User is already a member' }, 409 as const)
  await db.insert(teamMembers).values({ teamId: id, userId, role })
  return c.json({ ok: true }, 200 as const)
})

adminRouter.openapi(createRoute({
  method: 'put',
  path: '/api/admin/teams/{id}/members/{userId}',
  operationId: 'updateTeamMemberRole',
  tags: ['Admin'],
  summary: 'Update team member role',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), userId: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ role: z.enum(['owner', 'member']) }) } }, required: true },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Updated' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (!isTeamOwnerOrAdmin(c.get('userRole'))) return c.json({ error: 'Forbidden' }, 403 as const)
  const { id, userId } = c.req.valid('param')
  const { role } = c.req.valid('json')
  await db.update(teamMembers).set({ role }).where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, userId)))
  return c.json({ ok: true }, 200 as const)
})

adminRouter.openapi(createRoute({
  method: 'delete',
  path: '/api/admin/teams/{id}/members/{userId}',
  operationId: 'removeTeamMember',
  tags: ['Admin'],
  summary: 'Remove a user from a team',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string(), userId: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Removed' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (!isTeamOwnerOrAdmin(c.get('userRole'))) return c.json({ error: 'Forbidden' }, 403 as const)
  const { id, userId } = c.req.valid('param')
  await db.delete(teamMembers).where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, userId)))
  return c.json({ ok: true }, 200 as const)
})

// ── Team Services ─────────────────────────────────────────────────────────────

adminRouter.openapi(createRoute({
  method: 'get',
  path: '/api/admin/teams/{id}/services',
  operationId: 'listTeamServices',
  tags: ['Admin'],
  summary: 'List services belonging to a team',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ services: z.array(z.object({ id: z.string(), name: z.string(), displayName: z.string().nullable() })) }) } },
      description: 'Services',
    },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (!isTeamOwnerOrAdmin(c.get('userRole'))) return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')
  const rows = await db
    .select({ id: services.id, name: services.name, displayName: services.displayName })
    .from(services)
    .where(eq(services.teamId, id))
    .orderBy(services.name)
  return c.json({ services: rows }, 200 as const)
})

adminRouter.openapi(createRoute({
  method: 'put',
  path: '/api/admin/services/{serviceId}/team',
  operationId: 'assignServiceTeam',
  tags: ['Admin'],
  summary: 'Assign a service to a team',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ serviceId: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ teamId: z.string().nullable() }) } }, required: true },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Assigned' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (!isSuperAdmin(c)) return c.json({ error: 'Forbidden' }, 403 as const)
  const { serviceId } = c.req.valid('param')
  const { teamId } = c.req.valid('json')
  await db.update(services).set({ teamId }).where(eq(services.id, serviceId))
  return c.json({ ok: true }, 200 as const)
})

// ── Cross-team Grants ─────────────────────────────────────────────────────────

const GrantSchema = z.object({
  id: z.string(),
  ownerTeamId: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  branches: z.array(z.string()).nullable(),
  granteeTeamId: z.string().nullable(),
  granteeUserId: z.string().nullable(),
  grantedBy: z.string(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
})

adminRouter.openapi(createRoute({
  method: 'get',
  path: '/api/admin/teams/{id}/grants',
  operationId: 'listTeamGrants',
  tags: ['Admin'],
  summary: 'List cross-team grants for a team (as owner or grantee)',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ outgoing: z.array(GrantSchema), incoming: z.array(GrantSchema) }) } }, description: 'Grants' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (!isTeamOwnerOrAdmin(c.get('userRole'))) return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')

  const grantCols = {
    id: crossTeamGrants.id,
    ownerTeamId: crossTeamGrants.ownerTeamId,
    serviceId: crossTeamGrants.serviceId,
    serviceName: services.name,
    branches: crossTeamGrants.branches,
    granteeTeamId: crossTeamGrants.granteeTeamId,
    granteeUserId: crossTeamGrants.granteeUserId,
    grantedBy: crossTeamGrants.grantedBy,
    expiresAt: crossTeamGrants.expiresAt,
    createdAt: crossTeamGrants.createdAt,
  }

  const toRow = (r: { id: string; ownerTeamId: string; serviceId: string; serviceName: string; branches: string[] | null; granteeTeamId: string | null; granteeUserId: string | null; grantedBy: string; expiresAt: Date | null; createdAt: Date }) => ({
    id: r.id,
    ownerTeamId: r.ownerTeamId,
    serviceId: r.serviceId,
    serviceName: r.serviceName,
    branches: r.branches,
    granteeTeamId: r.granteeTeamId,
    granteeUserId: r.granteeUserId,
    grantedBy: r.grantedBy,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  })

  const outgoingRows = await db
    .select(grantCols)
    .from(crossTeamGrants)
    .innerJoin(services, eq(services.id, crossTeamGrants.serviceId))
    .where(eq(crossTeamGrants.ownerTeamId, id))

  const incomingRows = await db
    .select(grantCols)
    .from(crossTeamGrants)
    .innerJoin(services, eq(services.id, crossTeamGrants.serviceId))
    .where(eq(crossTeamGrants.granteeTeamId, id))

  return c.json({ outgoing: outgoingRows.map(toRow), incoming: incomingRows.map(toRow) }, 200 as const)
})

adminRouter.openapi(createRoute({
  method: 'post',
  path: '/api/admin/teams/{id}/grants',
  operationId: 'createGrant',
  tags: ['Admin'],
  summary: 'Create a cross-team grant',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            serviceId: z.string(),
            branches: z.array(z.string()).optional(),
            granteeTeamId: z.string().optional(),
            granteeUserId: z.string().optional(),
            expiresAt: z.string().datetime().optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ id: z.string() }) } }, description: 'Grant created' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Bad request' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (!isTeamOwnerOrAdmin(c.get('userRole'))) return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')
  const { serviceId, branches, granteeTeamId, granteeUserId, expiresAt } = c.req.valid('json')
  if (!granteeTeamId && !granteeUserId) return c.json({ error: 'Must specify granteeTeamId or granteeUserId' }, 400 as const)
  if (granteeTeamId && granteeUserId) return c.json({ error: 'Cannot specify both granteeTeamId and granteeUserId' }, 400 as const)
  const grantedBy = c.get('userId')
  const [grant] = await db.insert(crossTeamGrants).values({
    ownerTeamId: id,
    serviceId,
    branches: branches ?? null,
    granteeTeamId: granteeTeamId ?? null,
    granteeUserId: granteeUserId ?? null,
    grantedBy,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning({ id: crossTeamGrants.id })
  return c.json({ id: grant.id }, 200 as const)
})

adminRouter.openapi(createRoute({
  method: 'delete',
  path: '/api/admin/grants/{id}',
  operationId: 'deleteGrant',
  tags: ['Admin'],
  summary: 'Revoke a cross-team grant',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Revoked' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  },
}), async (c) => {
  if (!isTeamOwnerOrAdmin(c.get('userRole'))) return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')
  const result = await db.delete(crossTeamGrants).where(eq(crossTeamGrants.id, id)).returning({ id: crossTeamGrants.id })
  if (!result.length) return c.json({ error: 'Grant not found' }, 404 as const)
  return c.json({ ok: true }, 200 as const)
})

// ── Users ─────────────────────────────────────────────────────────────────────

const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  teams: z.array(z.object({ id: z.string(), name: z.string(), role: z.string() })),
})

adminRouter.openapi(createRoute({
  method: 'get',
  path: '/api/admin/users',
  operationId: 'listUsers',
  tags: ['Admin'],
  summary: 'List all users',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { 'application/json': { schema: z.object({ users: z.array(UserSchema) }) } }, description: 'Users' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (!isSuperAdmin(c)) return c.json({ error: 'Forbidden' }, 403 as const)

  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt,
  }).from(users).orderBy(users.email)

  const allMembers = await db.select({
    userId: teamMembers.userId,
    teamId: teamMembers.teamId,
    teamName: teams.name,
    teamRole: teamMembers.role,
  }).from(teamMembers).innerJoin(teams, eq(teams.id, teamMembers.teamId))

  const memberMap = new Map<string, { id: string; name: string; role: string }[]>()
  for (const m of allMembers) {
    if (!memberMap.has(m.userId)) memberMap.set(m.userId, [])
    memberMap.get(m.userId)!.push({ id: m.teamId, name: m.teamName, role: m.teamRole })
  }

  return c.json({
    users: allUsers.map(u => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      teams: memberMap.get(u.id) ?? [],
    })),
  }, 200 as const)
})

adminRouter.openapi(createRoute({
  method: 'put',
  path: '/api/admin/users/{id}',
  operationId: 'updateUser',
  tags: ['Admin'],
  summary: 'Update user (role or active status)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            role: z.enum(['super_admin', 'team_owner', 'team_member', 'guest']).optional(),
            isActive: z.boolean().optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Updated' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (!isSuperAdmin(c)) return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  await db.update(users).set(body).where(eq(users.id, id))
  return c.json({ ok: true }, 200 as const)
})

adminRouter.openapi(createRoute({
  method: 'delete',
  path: '/api/admin/users/{id}',
  operationId: 'deleteUser',
  tags: ['Admin'],
  summary: 'Delete a user',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Deleted' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (!isSuperAdmin(c)) return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')
  // Prevent self-deletion
  if (id === c.get('userId')) return c.json({ error: 'Cannot delete yourself' }, 403 as const)
  await db.delete(users).where(eq(users.id, id))
  return c.json({ ok: true }, 200 as const)
})

// ── Me (current user info) ────────────────────────────────────────────────────

adminRouter.openapi(createRoute({
  method: 'get',
  path: '/api/me',
  operationId: 'getMe',
  tags: ['Auth'],
  summary: 'Get current user info',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.string(),
            email: z.string(),
            role: z.string(),
            teams: z.array(z.object({ id: z.string(), name: z.string(), displayName: z.string().nullable(), role: z.string() })),
          }),
        },
      },
      description: 'Current user',
    },
    401: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Unauthorized' },
  },
}), async (c) => {
  const userId = c.get('userId')
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, email: true, role: true } })
  if (!user) return c.json({ error: 'Unauthorized' }, 401 as const)
  const memberships = await db
    .select({ id: teams.id, name: teams.name, displayName: teams.displayName, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId))
  return c.json({ ...user, teams: memberships }, 200 as const)
})

adminRouter.use('/api/me', jwtAuth)
