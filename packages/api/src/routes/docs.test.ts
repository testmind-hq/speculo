import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: 'spec-1' }]),
        })),
      })),
    })),
  },
}))

vi.mock('../services/permissions.js', () => ({
  canAccessService: vi.fn().mockResolvedValue(true),
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

async function makeToken(role = 'guest') {
  const { sign } = await import('hono/jwt')
  return sign({ userId: 'user-1', role, exp: Math.floor(Date.now() / 1000) + 3600 }, process.env.JWT_SECRET!)
}

const { docsRouter } = await import('./docs.js')
const app = new Hono().route('/', docsRouter)

describe('GET /docs/:service/:branch', () => {
  it('redirects to /login without auth', async () => {
    const res = await app.request('/docs/user-service/main')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
  })

  it('returns HTML with Scalar when authenticated and authorized', async () => {
    const token = await makeToken()
    const res = await app.request('/docs/user-service/main', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('Scalar')
  })

  it('redirects to /catalog when user is not authorized to access the service', async () => {
    vi.mocked((await import('../services/permissions.js')).canAccessService)
      .mockResolvedValueOnce(false)
    const token = await makeToken()
    const res = await app.request('/docs/user-service/main', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/catalog')
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
