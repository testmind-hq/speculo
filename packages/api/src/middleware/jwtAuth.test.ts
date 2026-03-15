import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { jwtAuth } from './jwtAuth.js'

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
    const body = await res.json()
    expect(body.userId).toBe('test-id')
  })
})
