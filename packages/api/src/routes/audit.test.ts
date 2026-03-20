import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

const mockLogs = [
  {
    id: 'log-1',
    userId: 'user-1',
    userEmail: 'admin@example.com',
    action: 'spec_uploaded',
    targetId: 'svc-1',
    targetName: 'user-service',
    meta: null,
    createdAt: new Date(),
  },
]

// The route calls db.select() twice via Promise.all:
//   1. rows query:  select().from(auditLogs).leftJoin(users).where().orderBy().limit().offset()
//   2. count query: select({ count }).from(auditLogs).where()
// We use mockReturnValueOnce to return them in order.
const rowsChain: any = {
  where: vi.fn(() => rowsChain),
  orderBy: vi.fn(() => rowsChain),
  limit: vi.fn(() => rowsChain),
  offset: vi.fn().mockResolvedValue(mockLogs),
}
const countChain: any = {
  where: vi.fn().mockResolvedValue([{ count: '1' }]),
}

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn()
      .mockReturnValueOnce({ from: vi.fn(() => ({ leftJoin: vi.fn(() => rowsChain) })) })
      .mockReturnValueOnce({ from: vi.fn(() => countChain) }),
  },
}))

vi.mock('../middleware/jwtAuth.js', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'user-1')
    c.set('userRole', 'super_admin')
    await next()
  }),
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

const { auditRouter } = await import('./audit.js')
const app = new Hono().route('/', auditRouter)

describe('GET /api/admin/audit-logs', () => {
  it('returns audit log entries for super_admin', async () => {
    const res = await app.request('/api/admin/audit-logs')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.logs).toHaveLength(1)
    expect(body.logs[0].action).toBe('spec_uploaded')
    expect(body.total).toBe(1)
  })

  it('returns 403 for non-super_admin', async () => {
    vi.mocked((await import('../middleware/jwtAuth.js')).jwtAuth)
      .mockImplementationOnce(async (c: any, next: any) => {
        c.set('userId', 'user-2')
        c.set('userRole', 'team_owner')
        await next()
      })
    const res = await app.request('/api/admin/audit-logs')
    expect(res.status).toBe(403)
  })
})
