import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    query: { mcpTokens: { findFirst: vi.fn().mockResolvedValue(null) } },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(async () => false),
  },
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

const { uploadAuth } = await import('./uploadAuth.js')

describe('uploadAuth middleware', () => {
  it('rejects with no Authorization header', async () => {
    const app = new Hono()
    app.use('/upload', uploadAuth)
    app.post('/upload', (c) => c.json({ ok: true }))

    const res = await app.request('/upload', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})
