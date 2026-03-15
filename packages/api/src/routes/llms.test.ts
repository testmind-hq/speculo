import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { specContent: JSON.stringify({ openapi: '3.1.0', info: { title: 'Test', version: '1' }, paths: {} }) },
          ]),
        })),
      })),
    })),
  },
}))
vi.mock('@scalar/openapi-to-markdown', () => ({
  createMarkdownFromOpenApi: vi.fn().mockResolvedValue('# Test API\n\nNo endpoints.'),
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

const { llmsRouter } = await import('./llms.js')
const app = new Hono().route('/', llmsRouter)

describe('GET /docs/:service/:branch/llms.txt', () => {
  it('returns plain text markdown', async () => {
    const res = await app.request('/docs/user-service/main/llms.txt')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const text = await res.text()
    expect(text).toContain('# Test API')
  })

  it('returns 404 for unknown service (no auth required)', async () => {
    vi.mocked((await import('../db/index.js')).db.select)
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }) } as any)
    const res = await app.request('/docs/unknown/main/llms.txt')
    expect(res.status).toBe(404)
  })
})
