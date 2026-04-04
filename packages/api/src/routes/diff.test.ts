import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'

const specA = JSON.stringify({
  openapi: '3.1.0',
  info: { title: 'A', version: '1' },
  paths: {
    '/users': { get: { operationId: 'listUsers', summary: 'List users', responses: {} } },
    '/users/{id}': { get: { operationId: 'getUser', summary: 'Get user', responses: {} } },
  },
})
const specB = JSON.stringify({
  openapi: '3.1.0',
  info: { title: 'A', version: '2' },
  paths: {
    '/users': { get: { operationId: 'listUsers', summary: 'List users v2', responses: {} } },
    '/users/{id}/profile': { get: { operationId: 'getUserProfile', summary: 'Get profile', responses: {} } },
  },
})

const mockVersionFrom = { id: 'ver-1', serviceId: 'svc-1', branch: 'main', uploadedAt: new Date(), specContent: specA }
const mockVersionTo   = { id: 'ver-2', serviceId: 'svc-1', branch: 'main', uploadedAt: new Date(), specContent: specB }
const mockVersionList = [{ ...mockVersionTo, commitSha: null, isLatest: true, endpointCount: 2 }, { ...mockVersionFrom, commitSha: null, isLatest: false, endpointCount: 2 }]

const mockService = { id: 'svc-1', name: 'user-service' }

vi.mock('../db/index.js', () => ({
  db: {
    query: {
      services: {
        findFirst: vi.fn().mockResolvedValue(mockService),
      },
      specVersions: {
        findFirst: vi.fn().mockResolvedValue(mockVersionFrom),
        findMany: vi.fn().mockResolvedValue(mockVersionList),
      },
    },
  },
}))

vi.mock('../middleware/jwtAuth.js', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'user-1')
    c.set('userRole', 'guest')
    await next()
  }),
}))

vi.mock('../services/permissions.js', () => ({
  canAccessService: vi.fn().mockResolvedValue(true),
}))

const { diffRouter } = await import('./diff.js')
const app = new Hono().route('/', diffRouter)

describe('GET /api/diff', () => {
  it('returns added, removed, modified endpoint lists', async () => {
    vi.mocked((await import('../db/index.js')).db.query.specVersions.findFirst)
      .mockResolvedValueOnce(mockVersionFrom as any)
      .mockResolvedValueOnce(mockVersionTo as any)

    const res = await app.request('/api/diff?from=ver-1&to=ver-2')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.added).toBeInstanceOf(Array)
    expect(body.removed).toBeInstanceOf(Array)
    expect(body.modified).toBeInstanceOf(Array)
    // /users/{id} removed, /users/{id}/profile added, /users GET modified (summary changed)
    expect(body.removed).toHaveLength(1)
    expect(body.added).toHaveLength(1)
    expect(body.modified).toHaveLength(1)
  })

  it('returns 404 when version not found', async () => {
    vi.mocked((await import('../db/index.js')).db.query.specVersions.findFirst)
      .mockResolvedValueOnce(undefined as any)
    const res = await app.request('/api/diff?from=missing&to=ver-2')
    expect(res.status).toBe(404)
  })

  it('returns 403 when user cannot access the service', async () => {
    vi.mocked((await import('../db/index.js')).db.query.specVersions.findFirst)
      .mockResolvedValueOnce(mockVersionFrom as any)
      .mockResolvedValueOnce(mockVersionTo as any)
    vi.mocked((await import('../services/permissions.js')).canAccessService)
      .mockResolvedValueOnce(false)
    const res = await app.request('/api/diff?from=ver-1&to=ver-2')
    expect(res.status).toBe(403)
  })
})

describe('GET /api/specs/:service/versions', () => {
  it('returns version list for a service branch', async () => {
    const res = await app.request('/api/specs/user-service/versions?branch=main')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.versions).toBeInstanceOf(Array)
    expect(body.versions).toHaveLength(2)
  })

  it('returns 404 when service not found', async () => {
    vi.mocked((await import('../db/index.js')).db.query.services.findFirst)
      .mockResolvedValueOnce(undefined as any)
    const res = await app.request('/api/specs/unknown/versions?branch=main')
    expect(res.status).toBe(404)
  })

  it('returns 403 when user cannot access the service', async () => {
    vi.mocked((await import('../services/permissions.js')).canAccessService)
      .mockResolvedValueOnce(false)
    const res = await app.request('/api/specs/restricted-service/versions?branch=main')
    expect(res.status).toBe(403)
  })
})
