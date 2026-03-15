import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// Mock DB
vi.mock('../db/index.js', () => {
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'tok-id', name: 'my-token', scope: 'read', prefix: 'speculo_mcp_ab', createdAt: new Date(),
        }]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    query: {
      users: {
        // Default: returns a super_admin user for jwtAuth and register route lookups
        findFirst: vi.fn().mockResolvedValue({ id: 'user-1', role: 'super_admin', isActive: true }),
      },
    },
  }
  return { db: mockDb }
})

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async () => 'hashed'),
    compare: vi.fn(async () => true),
  },
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)
process.env.JWT_EXPIRY_DAYS = '7'

const { authRouter } = await import('./auth.js')
const app = new Hono().route('/', authRouter)

// helper to make a signed JWT
async function makeToken(userId = 'user-1') {
  const { sign } = await import('hono/jwt')
  return sign({ userId, exp: Math.floor(Date.now() / 1000) + 3600 }, process.env.JWT_SECRET!)
}

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
    const token = await makeToken('user-1')
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: 'test@test.com' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/login', () => {
  it('returns 400 for missing fields', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/tokens/:id', () => {
  it('returns 401 without JWT', async () => {
    const res = await app.request('/api/tokens/some-id', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/tokens', () => {
  it('returns 401 without JWT', async () => {
    const res = await app.request('/api/tokens')
    expect(res.status).toBe(401)
  })
})
