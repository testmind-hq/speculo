import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            { method: 'GET', path: '/users', summary: 'List users', operationId: 'listUsers', tags: ['users'], serviceName: 'user-service', branch: 'main' },
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

const { searchRouter } = await import('./search.js')
const app = new Hono().route('/', searchRouter)

describe('GET /api/search', () => {
  it('returns 400 when q is missing', async () => {
    const res = await app.request('/api/search?service=user-service')
    expect(res.status).toBe(400)
  })

  it('returns results array', async () => {
    const res = await app.request('/api/search?q=users&service=user-service')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.results)).toBe(true)
  })
})
