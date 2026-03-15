import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([
            {
              id: 'svc-1',
              name: 'user-service',
              displayName: 'User Service',
              branch: 'main',
              endpointCount: 5,
              uploadedAt: new Date(),
            },
          ]),
        })),
      })),
    })),
  },
}))

vi.mock('../middleware/jwtAuth.js', () => ({
  jwtAuth: vi.fn(async (_c: any, next: any) => next()),
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

const { catalogRouter } = await import('./catalog.js')
const app = new Hono().route('/', catalogRouter)

describe('GET /api/catalog', () => {
  it('returns services grouped by name', async () => {
    const res = await app.request('/api/catalog')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.services).toHaveLength(1)
    expect(body.services[0].name).toBe('user-service')
    expect(body.services[0].branches).toHaveLength(1)
  })
})
