import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ── DB mock ────────────────────────────────────────────────────────────────────
vi.mock('../db/index.js', () => {
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'tok-1', name: 'my-token', scope: 'read', prefix: 'speculo_mcp_ab', lastUsedAt: null, createdAt: new Date() },
        ]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'tok-id', name: 'ci-token', scope: 'write', prefix: 'speculo_mcp_xy', createdAt: new Date(),
        }]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'tok-id' }]),
      }),
    }),
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'user-1', email: 'admin@example.com', passwordHash: 'hashed',
          role: 'super_admin', isActive: true,
        }),
      },
    },
  }
  return { db: mockDb }
})

vi.mock('bcryptjs', () => ({
  default: {
    hash:    vi.fn(async () => 'hashed'),
    compare: vi.fn(async () => true),
  },
}))

process.env.DATABASE_URL  = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET    = 'a'.repeat(32)
process.env.JWT_EXPIRY_DAYS = '7'

const { authRouter } = await import('./auth.js')
const app = new Hono().route('/', authRouter)

async function makeToken(userId = 'user-1') {
  const { sign } = await import('hono/jwt')
  return sign({ userId, exp: Math.floor(Date.now() / 1000) + 3600 }, process.env.JWT_SECRET!)
}

// ── Register ──────────────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('returns 401 without JWT', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing fields when authenticated', async () => {
    const token = await makeToken()
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: 'test@test.com' }), // missing password
    })
    expect(res.status).toBe(400)
  })
})

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('returns 400 for missing fields', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 for disabled user', async () => {
    const { db } = await import('../db/index.js')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ id: 'user-1', email: 'admin@example.com', passwordHash: 'hashed', role: 'super_admin', isActive: false } as any)
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'correct-pass' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 for unknown email', async () => {
    const { db } = await import('../db/index.js')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'pass' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 for wrong password', async () => {
    const bcrypt = await import('bcryptjs')
    vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(false as never)
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns JWT token on successful login', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'correct-pass' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(typeof body.token).toBe('string')
    expect(body.token.length).toBeGreaterThan(10)
    expect(body.userId).toBe('user-1')
    expect(body.role).toBe('super_admin')
  })
})

// ── MCP Tokens ────────────────────────────────────────────────────────────────

describe('GET /api/tokens', () => {
  it('returns 401 without JWT', async () => {
    const res = await app.request('/api/tokens')
    expect(res.status).toBe(401)
  })

  it('returns token list for authenticated user', async () => {
    const token = await makeToken()
    const res = await app.request('/api/tokens', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(Array.isArray(body.tokens)).toBe(true)
  })
})

describe('POST /api/tokens', () => {
  it('returns 400 for missing fields', async () => {
    const token = await makeToken()
    const res = await app.request('/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'ci' }), // missing scope
    })
    expect(res.status).toBe(400)
  })

  it('creates token and returns plaintext once', async () => {
    const token = await makeToken()
    const res = await app.request('/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'ci-pipeline', scope: 'write' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.id).toBeTruthy()
    expect(typeof body.token).toBe('string')
    expect(body.token).toMatch(/^speculo_mcp_/)
    expect(body.scope).toBe('write')
  })
})

describe('DELETE /api/tokens/:id', () => {
  it('returns 401 without JWT', async () => {
    const res = await app.request('/api/tokens/some-id', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })

  it('deletes token and returns ok', async () => {
    const token = await makeToken()
    const res = await app.request('/api/tokens/tok-id', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
  })

  it('returns 404 when token not found or belongs to another user', async () => {
    const { db } = await import('../db/index.js')
    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    } as any)
    const token = await makeToken()
    const res = await app.request('/api/tokens/no-such', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(404)
  })
})
