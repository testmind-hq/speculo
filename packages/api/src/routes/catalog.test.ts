import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

const mockServiceRow = {
  id: 'svc-1',
  name: 'user-service',
  displayName: 'User Service',
  teamId: 'team-1',
  teamName: null,
  branch: 'main',
  endpointCount: 5,
  uploadedAt: new Date(),
}

// The catalog query chain: select().from().leftJoin().innerJoin().$dynamic().where().orderBy()
const dynamicChain: any = {
  where: vi.fn(() => dynamicChain),
  orderBy: vi.fn().mockResolvedValue([mockServiceRow]),
}
const catalogChain = {
  from: vi.fn(() => ({
    leftJoin: vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        $dynamic: vi.fn(() => dynamicChain),
      })),
    })),
  })),
}

vi.mock('../db/index.js', () => ({
  db: {
    // Always return the catalog chain (super_admin skips permission queries)
    select: vi.fn(() => catalogChain),
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

const { catalogRouter } = await import('./catalog.js')
const app = new Hono().route('/', catalogRouter)

describe('GET /api/catalog', () => {
  it('returns services grouped by name for super_admin', async () => {
    const res = await app.request('/api/catalog')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.services).toHaveLength(1)
    expect(body.services[0].name).toBe('user-service')
    expect(body.services[0].branches).toHaveLength(1)
  })
})
