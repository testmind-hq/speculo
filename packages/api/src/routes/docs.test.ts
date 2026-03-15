import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { specContent: JSON.stringify({ openapi: '3.1.0', info: { title: 'Test', version: '1' }, paths: {} }) },
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

const { docsRouter } = await import('./docs.js')
const app = new Hono().route('/', docsRouter)

describe('GET /docs/:service/:branch', () => {
  it('returns HTML with Scalar', async () => {
    const res = await app.request('/docs/user-service/main')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('Scalar')
    expect(html).toContain('"openapi"')
  })

  it('returns 404 for unknown service', async () => {
    vi.mocked((await import('../db/index.js')).db.select)
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }) } as any)

    const res = await app.request('/docs/unknown/main')
    expect(res.status).toBe(404)
  })
})
