import { http, HttpResponse } from 'msw'

const MOCK_TOKEN = 'mock-jwt-token'
const MOCK_MCP_TOKEN = 'speculo_mcp_mocktokenvalue123456789'

export const handlers = [
  // Auth
  http.post('/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    if (body.email === 'admin@example.com' && body.password === 'password123') {
      return HttpResponse.json({ token: MOCK_TOKEN, userId: 'user-1' })
    }
    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }),

  http.post('/auth/register', async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    return HttpResponse.json({ token: MOCK_TOKEN, userId: 'user-new' })
  }),

  // Catalog
  http.get('/api/catalog', () => {
    return HttpResponse.json({
      services: [
        {
          id: 'svc-1',
          name: 'user-service',
          displayName: 'User Service',
          branches: [
            { branch: 'main', endpointCount: 12, uploadedAt: new Date().toISOString() },
            { branch: 'dev', endpointCount: 15, uploadedAt: new Date().toISOString() },
          ],
        },
        {
          id: 'svc-2',
          name: 'payment-service',
          displayName: null,
          branches: [
            { branch: 'main', endpointCount: 8, uploadedAt: new Date().toISOString() },
          ],
        },
      ],
    })
  }),

  // MCP Tokens
  http.get('/api/tokens', () => {
    return HttpResponse.json({
      tokens: [
        {
          id: 'tok-1',
          name: 'Cursor',
          scope: 'read',
          prefix: 'speculo_mcp_curs',
          lastUsedAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
    })
  }),

  http.post('/api/tokens', async ({ request }) => {
    const body = await request.json() as { name: string; scope: string }
    return HttpResponse.json({
      id: 'tok-new',
      name: body.name,
      scope: body.scope,
      prefix: 'speculo_mcp_newt',
      createdAt: new Date().toISOString(),
      token: MOCK_MCP_TOKEN,
    })
  }),

  http.delete('/api/tokens/:id', () => {
    return HttpResponse.json({ ok: true })
  }),

  // Upload
  http.post('/api/upload', () => {
    return HttpResponse.json({
      service: 'test-service',
      branch: 'main',
      endpointCount: 5,
      wasConverted: false,
      warnings: [],
    })
  }),
]
