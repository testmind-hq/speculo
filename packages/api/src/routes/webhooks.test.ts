import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

const mockConfig = {
  id: 'wh-1', name: 'Feishu Notif', teamId: null, url: 'https://open.feishu.cn/x',
  providerType: 'feishu', events: ['spec.uploaded'], isActive: true,
  createdBy: 'user-1', createdAt: new Date(),
}

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([mockConfig]),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([mockConfig]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([mockConfig]),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
    query: {
      webhookConfigs: {
        findFirst: vi.fn().mockResolvedValue(mockConfig),
      },
    },
  },
}))

const mockSend = vi.fn().mockResolvedValue(undefined)

vi.mock('../services/webhooks.js', () => ({
  emitWebhookEvent: vi.fn().mockResolvedValue(undefined),
  feishuProvider: { send: mockSend },
  providers: { feishu: { send: mockSend } },
}))

vi.mock('../middleware/jwtAuth.js', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'user-1')
    c.set('userRole', 'super_admin')
    await next()
  }),
}))

const { webhooksRouter } = await import('./webhooks.js')
const app = new Hono().route('/', webhooksRouter)

describe('GET /api/admin/webhooks', () => {
  it('returns list of webhook configs', async () => {
    const res = await app.request('/api/admin/webhooks')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.webhooks).toHaveLength(1)
    expect(body.webhooks[0].name).toBe('Feishu Notif')
  })
})

describe('POST /api/admin/webhooks', () => {
  it('creates a webhook config', async () => {
    const res = await app.request('/api/admin/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', url: 'https://open.feishu.cn/x', events: ['spec.uploaded'] }),
    })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/admin/webhooks/:id', () => {
  it('updates a webhook config', async () => {
    const res = await app.request('/api/admin/webhooks/00000000-0000-0000-0000-000000000001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/admin/webhooks/:id', () => {
  it('deletes a webhook config and returns 204', async () => {
    const res = await app.request('/api/admin/webhooks/00000000-0000-0000-0000-000000000001', {
      method: 'DELETE',
    })
    expect(res.status).toBe(204)
  })
})

describe('POST /api/admin/webhooks/:id/test', () => {
  it('sends a test event directly to the provider and returns ok', async () => {
    const res = await app.request('/api/admin/webhooks/00000000-0000-0000-0000-000000000001/test', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
  })
})
