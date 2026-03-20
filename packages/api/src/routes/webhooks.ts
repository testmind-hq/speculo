import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { webhookConfigs } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'
import { emitWebhookEvent } from '../services/webhooks.js'

export const webhooksRouter = new OpenAPIHono()
webhooksRouter.use('/api/admin/webhooks', jwtAuth)
webhooksRouter.use('/api/admin/webhooks/:id', jwtAuth)
webhooksRouter.use('/api/admin/webhooks/:id/test', jwtAuth)

const WebhookConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  teamId: z.string().nullable(),
  url: z.string(),
  providerType: z.string(),
  events: z.array(z.string()),
  isActive: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string(),
})

// List
webhooksRouter.openapi(createRoute({
  method: 'get',
  path: '/api/admin/webhooks',
  operationId: 'listWebhooks',
  tags: ['Admin'],
  summary: 'List webhook configs (super_admin only)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { 'application/json': { schema: z.object({ webhooks: z.array(WebhookConfigSchema) }) } }, description: 'Webhook configs' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (c.get('userRole') !== 'super_admin') return c.json({ error: 'Forbidden' }, 403 as const)
  const rows = await db.select().from(webhookConfigs).where(sql`true`)
  return c.json({ webhooks: rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })) }, 200 as const)
})

// Create
webhooksRouter.openapi(createRoute({
  method: 'post',
  path: '/api/admin/webhooks',
  operationId: 'createWebhook',
  tags: ['Admin'],
  summary: 'Create a webhook config',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1),
            teamId: z.string().uuid().optional(),
            url: z.string().url(),
            providerType: z.string().optional(),
            events: z.array(z.string()).min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: WebhookConfigSchema } }, description: 'Created' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (c.get('userRole') !== 'super_admin') return c.json({ error: 'Forbidden' }, 403 as const)
  const userId = c.get('userId')
  if (!userId) return c.json({ error: 'Unauthorized' }, 403 as const)
  const { name, teamId, url, providerType, events } = c.req.valid('json')
  const [row] = await db.insert(webhookConfigs).values({
    name, teamId: teamId ?? null, url, providerType: providerType ?? 'feishu',
    events, createdBy: userId,
  }).returning()
  return c.json({ ...row, createdAt: row.createdAt.toISOString() }, 200 as const)
})

// Update
webhooksRouter.openapi(createRoute({
  method: 'put',
  path: '/api/admin/webhooks/:id',
  operationId: 'updateWebhook',
  tags: ['Admin'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().optional(),
            url: z.string().url().optional(),
            events: z.array(z.string()).optional(),
            isActive: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: WebhookConfigSchema } }, description: 'Updated' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  },
}), async (c) => {
  if (c.get('userRole') !== 'super_admin') return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const [row] = await db.update(webhookConfigs).set(body).where(eq(webhookConfigs.id, id)).returning()
  if (!row) return c.json({ error: 'Not found' }, 404 as const)
  return c.json({ ...row, createdAt: row.createdAt.toISOString() }, 200 as const)
})

// Delete
webhooksRouter.openapi(createRoute({
  method: 'delete',
  path: '/api/admin/webhooks/:id',
  operationId: 'deleteWebhook',
  tags: ['Admin'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Deleted' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
  },
}), async (c) => {
  if (c.get('userRole') !== 'super_admin') return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')
  await db.delete(webhookConfigs).where(eq(webhookConfigs.id, id))
  return c.json({ ok: true }, 200 as const)
})

// Test endpoint
webhooksRouter.openapi(createRoute({
  method: 'post',
  path: '/api/admin/webhooks/:id/test',
  operationId: 'testWebhook',
  tags: ['Admin'],
  summary: 'Send a test event to a webhook',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Sent' },
    403: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Forbidden' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  },
}), async (c) => {
  if (c.get('userRole') !== 'super_admin') return c.json({ error: 'Forbidden' }, 403 as const)
  const { id } = c.req.valid('param')
  const cfg = await db.query.webhookConfigs.findFirst({ where: eq(webhookConfigs.id, id) })
  if (!cfg) return c.json({ error: 'Not found' }, 404 as const)
  await emitWebhookEvent({
    event: 'spec.uploaded',
    timestamp: new Date().toISOString(),
    actor: 'test',
    detail: { test: true },
  })
  return c.json({ ok: true }, 200 as const)
})
