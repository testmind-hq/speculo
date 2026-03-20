import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { type SQL, desc, eq, and, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { auditLogs, users } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

export const auditRouter = new OpenAPIHono()
auditRouter.use('/api/admin/audit-logs', jwtAuth)

const AuditLogSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  userEmail: z.string().nullable(),
  action: z.string(),
  targetId: z.string().nullable(),
  targetName: z.string().nullable(),
  meta: z.string().nullable(),
  createdAt: z.string(),
})

auditRouter.openapi(createRoute({
  method: 'get',
  path: '/api/admin/audit-logs',
  operationId: 'listAuditLogs',
  tags: ['Admin'],
  summary: 'List audit log entries (super_admin only)',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      action: z.string().optional(),
      userId: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      page: z.string().optional().default('1'),
      pageSize: z.string().optional().default('50'),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ logs: z.array(AuditLogSchema), total: z.number(), page: z.number(), pageSize: z.number() }) } },
      description: 'Audit logs',
    },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (c.get('userRole') !== 'super_admin') return c.json({ error: 'Forbidden' }, 403 as const)

  const { action, userId, from, to, page: pageStr, pageSize: pageSizeStr } = c.req.valid('query')
  const page = Math.max(1, Number(pageStr ?? 1))
  const pageSize = Math.min(200, Math.max(1, Number(pageSizeStr ?? 50)))
  const offset = (page - 1) * pageSize

  const conditions: SQL<unknown>[] = []
  if (action) conditions.push(eq(auditLogs.action, action as any))
  if (userId) conditions.push(eq(auditLogs.userId, userId))
  if (from) conditions.push(gte(auditLogs.createdAt, new Date(from)))
  if (to) conditions.push(lte(auditLogs.createdAt, new Date(to)))

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: users.email,
        action: auditLogs.action,
        targetId: auditLogs.targetId,
        targetName: auditLogs.targetName,
        meta: auditLogs.meta,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<string>`count(*)` }).from(auditLogs).where(whereClause),
  ])

  return c.json({
    logs: rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total: Number(count),
    page,
    pageSize,
  }, 200 as const)
})
