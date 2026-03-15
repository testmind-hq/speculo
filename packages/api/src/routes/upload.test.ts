import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../db/index.js', () => ({ db: { transaction: vi.fn() } }))
vi.mock('../middleware/uploadAuth.js', () => ({
  uploadAuth: vi.fn(async (_c: any, next: any) => next()),
}))
vi.mock('../services/specProcessor.js', () => ({
  normalizeSpec: vi.fn().mockResolvedValue({
    spec: { openapi: '3.1.0', paths: {} },
    wasConverted: false,
    warnings: [],
  }),
}))
vi.mock('../services/indexBuilder.js', () => ({ extractEndpoints: vi.fn(() => []) }))
vi.mock('../services/cache.js', () => ({ specCache: { delete: vi.fn() } }))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

const { uploadRouter } = await import('./upload.js')
const app = new Hono().route('/', uploadRouter)

describe('POST /api/upload', () => {
  it('returns 400 when service name is missing', async () => {
    const formData = new FormData()
    formData.append('branch', 'main')
    formData.append('file', new Blob(['openapi: "3.0.0"'], { type: 'text/yaml' }), 'openapi.yaml')

    const res = await app.request('/api/upload', { method: 'POST', body: formData })
    expect(res.status).toBe(400)
  })
})
