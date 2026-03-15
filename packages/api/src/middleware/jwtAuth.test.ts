import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue({ role: 'guest', isActive: true }),
      },
    },
  },
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

const { jwtAuth } = await import('./jwtAuth.js')

describe('jwtAuth middleware', () => {
  it('rejects requests with no Authorization header', async () => {
    const app = new Hono()
    app.use('/protected', jwtAuth)
    app.get('/protected', (c) => c.json({ ok: true }))

    const res = await app.request('/protected')
    expect(res.status).toBe(401)
  })

  it('rejects requests with invalid token', async () => {
    const app = new Hono()
    app.use('/protected', jwtAuth)
    app.get('/protected', (c) => c.json({ ok: true }))

    const res = await app.request('/protected', {
      headers: { Authorization: 'Bearer invalid.token.here' },
    })
    expect(res.status).toBe(401)
  })

  it('accepts valid JWT and sets userId in context', async () => {
    const { sign } = await import('hono/jwt')
    const token = await sign(
      { userId: 'test-id', exp: Math.floor(Date.now() / 1000) + 3600 },
      process.env.JWT_SECRET!
    )

    const app = new Hono()
    app.use('/protected', jwtAuth)
    app.get('/protected', (c) => c.json({ userId: c.get('userId') }))

    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { userId: string }
    expect(body.userId).toBe('test-id')
  })
})
