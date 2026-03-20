import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { id: 'spec-1' },
          ]),
        })),
      })),
    })),
  },
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

async function makeToken() {
  const { sign } = await import('hono/jwt')
  return sign({ userId: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 }, process.env.JWT_SECRET!)
}

const { docsRouter } = await import('./docs.js')
const app = new Hono().route('/', docsRouter)

describe('GET /docs/:service/:branch', () => {
  it('redirects to /login without auth', async () => {
    const res = await app.request('/docs/user-service/main')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
  })

  it('returns HTML with Scalar when authenticated', async () => {
    const token = await makeToken()
    const res = await app.request('/docs/user-service/main', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('Scalar')
    expect(html).toContain('spec')
  })

  it('returns 404 for unknown service', async () => {
    vi.mocked((await import('../db/index.js')).db.select)
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }) } as any)

    const token = await makeToken()
    const res = await app.request('/docs/unknown/main', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(404)
  })
})
