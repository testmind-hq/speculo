import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DB
const mockRows = [{ name: 'user-service', branch: 'main', endpointCount: 3, uploadedAt: new Date() }]
vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue(mockRows) })) })), where: vi.fn().mockResolvedValue(mockRows), limit: vi.fn().mockResolvedValue(mockRows) })) })),
    query: { specVersions: { findFirst: vi.fn().mockResolvedValue({ specContent: JSON.stringify({ openapi: '3.1.0', paths: { '/users': { get: { summary: 'List', operationId: 'listUsers', parameters: [] } } }, components: { schemas: { User: { type: 'object' } } } }) }) } },
  },
}))
vi.mock('../../services/cache.js', () => ({ specCache: { get: vi.fn(() => undefined), set: vi.fn() } }))
vi.mock('../../services/deref.js', () => ({ derefSpec: vi.fn(async (s) => s), safeSerialize: vi.fn((s) => s), getDerefedSpec: vi.fn(async () => null) }))

process.env.DATABASE_URL = 'postgresql://x:x@localhost/x'
process.env.JWT_SECRET = 'a'.repeat(32)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listServicesTool } from './listServices.js'
import { searchEndpointsTool } from './searchEndpoints.js'
import { getEndpointDetailTool } from './getEndpointDetail.js'
import { getSchemaDetailTool } from './getSchemaDetail.js'
import { getServiceMarkdownTool } from './getServiceMarkdown.js'

describe('MCP tools register without error', () => {
  it('registers all 5 tools on McpServer', () => {
    const server = new McpServer({ name: 'test', version: '1' })
    expect(() => {
      listServicesTool(server)
      searchEndpointsTool(server)
      getEndpointDetailTool(server)
      getSchemaDetailTool(server)
      getServiceMarkdownTool(server)
    }).not.toThrow()
  })
})
