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
// selectMock is reset in beforeEach so each test gets fresh chains.
const makeRowsChain = () => {
  const chain: any = {
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn().mockResolvedValue(mockLogs),
  }
  chain.where.mockReturnValue(chain)
  chain.orderBy.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  return chain
}
const makeCountChain = () => ({ where: vi.fn().mockResolvedValue([{ count: '1' }]) })

const selectMock = vi.fn()

vi.mock('../db/index.js', () => ({ db: { select: selectMock } }))

vi.mock('../middleware/jwtAuth.js', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'user-1')
    c.set('userRole', 'super_admin')
    await next()
  }),
}))

const { auditRouter } = await import('./audit.js')
const app = new Hono().route('/', auditRouter)

describe('GET /api/admin/audit-logs', () => {
  beforeEach(() => {
    selectMock
      .mockReturnValueOnce({ from: vi.fn(() => ({ leftJoin: vi.fn(() => makeRowsChain()) })) })
      .mockReturnValueOnce({ from: vi.fn(() => makeCountChain()) })
  })

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
