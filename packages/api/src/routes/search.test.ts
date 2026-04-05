import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

const mockSearchResult = {
  method: 'GET', path: '/users', summary: 'List users',
  operationId: 'listUsers', tags: ['users'],
  serviceName: 'user-service', branch: 'main',
}

const searchSelectMock = vi.fn()

vi.mock('../db/index.js', () => ({ db: { select: searchSelectMock } }))

vi.mock('../middleware/jwtAuth.js', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'user-1')
    c.set('userRole', 'super_admin')  // default: super_admin sees all
    await next()
  }),
}))

vi.mock('../services/permissions.js', () => ({
  getAccessibleServiceIds: vi.fn().mockResolvedValue(null),  // default: null = all
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

const { searchRouter } = await import('./search.js')
const app = new Hono().route('/', searchRouter)

// Helper: make a select chain that resolves to rows
function makeSearchChain(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(rows),
      })),
    })),
  }
}

// Helper: make a select chain for the service-name lookup
function makeNamesChain(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(rows),
    })),
  }
}

describe('GET /api/search', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when q is missing', async () => {
    const res = await app.request('/api/search?service=user-service')
    expect(res.status).toBe(400)
  })

  it('returns all results for super_admin (no permission filter)', async () => {
    searchSelectMock.mockReturnValueOnce(makeSearchChain([mockSearchResult]))

    const res = await app.request('/api/search?q=users')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.results).toHaveLength(1)
  })

  it('returns empty results when user has no accessible services', async () => {
    vi.mocked((await import('../services/permissions.js')).getAccessibleServiceIds)
      .mockResolvedValueOnce(new Set())  // empty set = no access

    const res = await app.request('/api/search?q=users')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.results).toEqual([])
  })

  it('filters results to accessible services for non-admin', async () => {
    vi.mocked((await import('../services/permissions.js')).getAccessibleServiceIds)
      .mockResolvedValueOnce(new Set(['svc-1']))  // one accessible service ID

    // First select: get service names from IDs
    searchSelectMock.mockReturnValueOnce(makeNamesChain([{ name: 'user-service' }]))
    // Second select: search with name filter
    searchSelectMock.mockReturnValueOnce(makeSearchChain([mockSearchResult]))

    const res = await app.request('/api/search?q=users')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.results).toHaveLength(1)
  })
})
