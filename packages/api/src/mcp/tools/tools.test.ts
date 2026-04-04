import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DB
const mockRows = [{ name: 'user-service', branch: 'main', endpointCount: 3, uploadedAt: new Date() }]
vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue(mockRows) })),
          $dynamic: vi.fn(() => ({
            where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue(mockRows) })),
            orderBy: vi.fn().mockResolvedValue(mockRows),
          })),
        })),
        where: vi.fn().mockResolvedValue(mockRows),
        limit: vi.fn().mockResolvedValue(mockRows),
      })),
    })),
    query: {
      specVersions: {
        findFirst: vi.fn().mockResolvedValue({
          specContent: JSON.stringify({
            openapi: '3.1.0',
            paths: { '/users': { get: { summary: 'List', operationId: 'listUsers', parameters: [] } } },
            components: { schemas: { User: { type: 'object' } } },
          }),
        }),
      },
    },
  },
}))
vi.mock('../../services/cache.js', () => ({ specCache: { get: vi.fn(() => undefined), set: vi.fn() } }))
vi.mock('../../services/deref.js', () => ({
  derefSpec: vi.fn(async (s) => s),
  safeSerialize: vi.fn((s) => s),
  getDerefedSpec: vi.fn(async () => null),
}))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listServicesTool } from './listServices.js'
import { searchEndpointsTool } from './searchEndpoints.js'
import { getEndpointDetailTool } from './getEndpointDetail.js'
import { getSchemaDetailTool } from './getSchemaDetail.js'
import { getServiceMarkdownTool } from './getServiceMarkdown.js'

const allowAll = async () => true
const denyAll = async () => false
const getAll = async () => null  // super_admin: null = all services

describe('MCP tools register without error', () => {
  it('registers all 5 tools on McpServer', () => {
    const server = new McpServer({ name: 'test', version: '1' })
    expect(() => {
      listServicesTool(server, getAll)
      searchEndpointsTool(server, allowAll)
      getEndpointDetailTool(server, allowAll)
      getSchemaDetailTool(server, allowAll)
      getServiceMarkdownTool(server, allowAll)
    }).not.toThrow()
  })
})

describe('searchEndpoints permission guard', () => {
  it('returns access-denied error when canAccess returns false', async () => {
    const server = new McpServer({ name: 'test', version: '1' })
    let callResult: any

    // Capture the tool callback by registering and calling it
    const originalTool = server.tool.bind(server)
    vi.spyOn(server, 'tool').mockImplementationOnce((name, desc, schema, handler) => {
      callResult = handler
      return originalTool(name, desc, schema, handler)
    })

    searchEndpointsTool(server, denyAll)
    const result = await callResult({ service: 'user-service', q: 'users' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Access denied')
  })
})
