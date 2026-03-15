import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', () => ({ db: {} }))
vi.mock('./server.js', () => ({
  mcpServer: { connect: vi.fn(), close: vi.fn() },
}))
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async () => 'hashed'),
    compare: vi.fn(async () => false),
  },
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

const { mcpRouter } = await import('./transport.js')
const app = new Hono().route('/', mcpRouter)

describe('MCP transport', () => {
  it('returns 401 for unauthenticated POST /mcp', async () => {
    const res = await app.request('/mcp', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})
