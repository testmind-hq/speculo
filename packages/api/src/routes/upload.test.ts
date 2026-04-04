import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createHash } from 'node:crypto'

// ── Auth middleware passthrough ────────────────────────────────────────────────
vi.mock('../middleware/uploadAuth.js', () => ({
  uploadAuth: vi.fn(async (_c: any, next: any) => next()),
}))

// ── Service mocks ──────────────────────────────────────────────────────────────
const MOCK_SPEC = { openapi: '3.1.0', paths: { '/users': { get: { summary: 'List users' } } } }
const MOCK_SPEC_JSON = JSON.stringify(MOCK_SPEC)
const MOCK_HASH = createHash('sha256').update(MOCK_SPEC_JSON).digest('hex')

vi.mock('../services/specProcessor.js', () => ({
  normalizeSpec: vi.fn().mockResolvedValue({
    spec: MOCK_SPEC,
    wasConverted: false,
    warnings: [],
  }),
}))
vi.mock('../services/indexBuilder.js', () => ({
  extractEndpoints: vi.fn(() => [
    { method: 'GET', path: '/users', serviceName: 'user-service', branch: 'main', specId: 'pending' },
  ]),
}))
vi.mock('../services/cache.js',       () => ({ specCache: { delete: vi.fn() } }))
vi.mock('../services/permissions.js', () => ({ getDefaultTeamId: vi.fn().mockResolvedValue('team-1') }))

// ── DB mock factory ───────────────────────────────────────────────────────────
const makeInsertChain = (returning: any[] = []) => ({
  values: vi.fn(() => ({
    returning: vi.fn().mockResolvedValue(returning),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  })),
})

const makeUpdateChain = () => ({
  set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
})

const makeDeleteChain = () => ({
  where: vi.fn().mockResolvedValue([]),
})

let txMock: any
let dbSelectResponses: any[]

vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn(() => makeInsertChain()),
    select: vi.fn(),
    transaction: vi.fn(async (fn: any) => fn(txMock)),
  },
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET   = 'a'.repeat(32)

const { uploadRouter } = await import('./upload.js')
const { db }           = await import('../db/index.js')
const app = new Hono().route('/', uploadRouter)

const makeTxSelectChain = (rows: any[] = []) => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(rows),
      })),
    })),
  })),
})

beforeEach(() => {
  // Default tx mock: insert spec_versions returns [{ id: 'new-spec-1' }]
  // tx.select for the pruning query returns < 5 rows → no delete triggered
  txMock = {
    update: vi.fn(() => makeUpdateChain()),
    insert: vi.fn(() => makeInsertChain([{ id: 'new-spec-1' }])),
    delete: vi.fn(() => makeDeleteChain()),
    select: vi.fn(() => makeTxSelectChain([{ id: 'new-spec-1' }])),
  }

  // Default db.select sequence:
  // 1st call → services select: [{ id: 'svc-1' }]
  // 2nd call → specVersions select (dedup check): [] (no current latest)
  dbSelectResponses = [
    { from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ id: 'svc-1' }]) })) },
    { from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) },
  ]
  vi.mocked(db.select)
    .mockReturnValueOnce(dbSelectResponses[0] as any)
    .mockReturnValueOnce(dbSelectResponses[1] as any)
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/upload', () => {
  it('returns 400 when service name is missing (multipart)', async () => {
    const form = new FormData()
    form.append('branch', 'main')
    form.append('file', new Blob(['openapi: "3.0.0"'], { type: 'text/yaml' }), 'openapi.yaml')

    const res = await app.request('/api/upload', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('returns 400 when spec normalisation fails', async () => {
    const { normalizeSpec } = await import('../services/specProcessor.js')
    vi.mocked(normalizeSpec).mockRejectedValueOnce(new Error('Invalid spec'))

    const res = await app.request('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'svc', branch: 'main', specContent: 'not-a-spec' }),
    })
    expect(res.status).toBe(400)
  })

  it('successfully uploads a JSON spec and returns endpointCount', async () => {
    const res = await app.request('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'user-service', branch: 'main', specContent: MOCK_SPEC_JSON }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.service).toBe('user-service')
    expect(body.branch).toBe('main')
    expect(body.endpointCount).toBeGreaterThanOrEqual(0)
    expect(body.wasConverted).toBe(false)
    expect(body.unchanged).toBeFalsy()
  })

  it('skips write and returns unchanged:true when spec hash matches current latest', async () => {
    // Override: 2nd select (dedup check) returns a row with the SAME hash
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ id: 'svc-1' }]) })) } as any)
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ id: 'sv-1', specHash: MOCK_HASH }]) })) } as any)

    const res = await app.request('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'user-service', branch: 'main', specContent: MOCK_SPEC_JSON }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.unchanged).toBe(true)
  })

  it('successfully uploads via multipart form-data', async () => {
    const form = new FormData()
    form.append('service', 'order-service')
    form.append('branch', 'feature/x')
    form.append('file', new Blob([MOCK_SPEC_JSON], { type: 'application/json' }), 'openapi.json')

    const res = await app.request('/api/upload', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.service).toBe('order-service')
    expect(body.branch).toBe('feature/x')
  })

  it('prunes old versions when 5 already exist', async () => {
    // Override: 2nd db.select (dedup check) returns a current latest with a DIFFERENT hash
    // so we proceed into the transaction (no early return).
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ id: 'svc-1' }]) })) } as any)
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ id: 'old-spec', specHash: 'different-hash' }]) })) } as any)

    // Return 5 versions from the pruning select — should trigger the prune delete
    const fiveVersionIds = ['v1', 'v2', 'v3', 'v4', 'v5'].map(id => ({ id }))
    txMock.select.mockReturnValueOnce(makeTxSelectChain(fiveVersionIds))

    const form = new FormData()
    form.append('service', 'my-service')
    form.append('branch', 'main')
    form.append('file', new Blob([JSON.stringify({ openapi: '3.1.0', info: { title: 'T', version: '1' }, paths: {} })], { type: 'application/json' }), 'openapi.json')

    const res = await app.request('/api/upload', {
      method: 'POST',
      body: form,
    })

    expect(res.status).toBe(200)
    // txMock.delete should have been called for:
    //   (1) old endpoint_index rows (because current exists with a different hash)
    //   (2) the prune delete (because keepIds.length === 5)
    expect(txMock.delete).toHaveBeenCalledTimes(2)
  })
})
