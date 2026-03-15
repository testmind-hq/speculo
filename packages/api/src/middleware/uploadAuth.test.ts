import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    // fire-and-forget lastUsedAt update inside uploadAuth
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ catch: vi.fn() }),
      }),
    }),
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(async () => false),
  },
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET   = 'a'.repeat(32)

const { uploadAuth } = await import('./uploadAuth.js')
const { db }         = await import('../db/index.js')

function makeApp() {
  const app = new Hono()
  app.use('/upload', uploadAuth)
  app.post('/upload', (c) => c.json({ ok: true }))
  return app
}

describe('uploadAuth middleware', () => {
  it('rejects with no Authorization header', async () => {
    const res = await makeApp().request('/upload', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('rejects with an invalid token', async () => {
    const res = await makeApp().request('/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer not.a.valid.jwt' },
    })
    expect(res.status).toBe(401)
  })

  it('accepts a valid JWT and sets userId', async () => {
    const { sign } = await import('hono/jwt')
    const token = await sign(
      { userId: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 },
      process.env.JWT_SECRET!
    )
    const app = new Hono()
    app.use('/upload', uploadAuth)
    app.post('/upload', (c) => c.json({ userId: c.get('userId') }))

    const res = await app.request('/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { userId: string }
    expect(body.userId).toBe('user-1')
  })

  it('accepts a valid write-scope MCP token', async () => {
    const bcrypt = await import('bcryptjs')
    // Fake token with the expected 24-char prefix
    const fakeToken = 'speculo_mcp_' + 'a'.repeat(32) // length > 24, prefix = first 24 chars
    const prefix    = fakeToken.slice(0, 24)

    // DB returns a write-scope candidate with matching prefix
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: 'tok-1', userId: 'ci-user', scope: 'write',
          prefix, tokenHash: 'hashed-token',
        }]),
      }),
    } as any)

    // bcrypt.compare returns true for this token
    vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(true as never)

    const app = new Hono()
    app.use('/upload', uploadAuth)
    app.post('/upload', (c) => c.json({ userId: c.get('userId') }))

    const res = await app.request('/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${fakeToken}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { userId: string }
    expect(body.userId).toBe('ci-user')
  })

  it('rejects a read-scope MCP token on the upload endpoint', async () => {
    const bcrypt = await import('bcryptjs')
    const fakeToken = 'speculo_mcp_' + 'b'.repeat(32)
    const prefix    = fakeToken.slice(0, 24)

    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: 'tok-2', userId: 'mcp-user', scope: 'read',
          prefix, tokenHash: 'hashed-token-b',
        }]),
      }),
    } as any)

    // Even if bcrypt matches, scope is 'read' so should be rejected
    vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(true as never)

    const res = await makeApp().request('/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${fakeToken}` },
    })
    expect(res.status).toBe(401)
  })
})
