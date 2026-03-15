import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { specContent: JSON.stringify({ openapi: '3.1.0', info: { title: 'T', version: '1' }, paths: {} }) },
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

const { specsRouter } = await import('./specs.js')
const app = new Hono().route('/', specsRouter)

describe('GET /api/specs/:service/:branch/openapi.json', () => {
  it('returns parsed OpenAPI JSON', async () => {
    const res = await app.request('/api/specs/user-service/main/openapi.json')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.openapi).toBe('3.1.0')
  })

  it('returns 404 for unknown service', async () => {
    vi.mocked((await import('../db/index.js')).db.select)
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }) } as any)
    const res = await app.request('/api/specs/unknown/main/openapi.json')
    expect(res.status).toBe(404)
  })
})
