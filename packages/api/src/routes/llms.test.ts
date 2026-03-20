import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'

// ── DB mock ────────────────────────────────────────────────────────────────────

const mockSpec = JSON.stringify({ openapi: '3.1.0', info: { title: 'Test', version: '1' }, paths: {} })

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ specContent: mockSpec }]),
        })),
      })),
    })),
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue({ isActive: true }),
      },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  },
}))

vi.mock('../services/permissions.js', () => ({
  canAccessBranch: vi.fn().mockResolvedValue(true),
}))

vi.mock('@scalar/openapi-to-markdown', () => ({
  createMarkdownFromOpenApi: vi.fn().mockResolvedValue('# Test API\n\nNo endpoints.'),
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

const { llmsRouter } = await import('./llms.js')
const { canAccessBranch } = await import('../services/permissions.js')
const app = new Hono().route('/', llmsRouter)

async function makeJwt() {
  return sign({ userId: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 }, 'a'.repeat(32), 'HS256')
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /docs/:service/:branch/llms.txt', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/docs/user-service/main/llms.txt')
    expect(res.status).toBe(401)
  })

  it('returns 403 when canAccessBranch is false', async () => {
    vi.mocked(canAccessBranch).mockResolvedValueOnce(false)
    const token = await makeJwt()
    const res = await app.request('/docs/user-service/main/llms.txt', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(403)
  })

  it('returns plain text markdown for authorized user', async () => {
    const token = await makeJwt()
    const res = await app.request('/docs/user-service/main/llms.txt', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const text = await res.text()
    expect(text).toContain('# Test API')
  })

  it('returns 404 for unknown service', async () => {
    const { db } = await import('../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
    } as any)
    const token = await makeJwt()
    const res = await app.request('/docs/unknown/main/llms.txt', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(404)
  })
})
