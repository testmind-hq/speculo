import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getAccessibleServiceIds, canAccessService } from '../services/permissions.js'
import { listServicesTool } from './tools/listServices.js'
import { searchEndpointsTool } from './tools/searchEndpoints.js'
import { getEndpointDetailTool } from './tools/getEndpointDetail.js'
import { getSchemaDetailTool } from './tools/getSchemaDetail.js'
import { getServiceMarkdownTool } from './tools/getServiceMarkdown.js'

export function createMcpServer(userId: string, userRole: string): McpServer {
  const server = new McpServer({ name: 'speculo', version: '1.0.0' })

  // Lazy permission cache — computed once per session on first tool call
  let cachedIds: Set<string> | null | undefined = undefined
  const getAccessibleIds = async (): Promise<Set<string> | null> => {
    if (cachedIds !== undefined) return cachedIds
    cachedIds = await getAccessibleServiceIds(userId, userRole)
    return cachedIds
  }

  const canAccess = (serviceName: string, branch?: string) =>
    canAccessService(userId, userRole, serviceName, branch)

  listServicesTool(server, getAccessibleIds)
  searchEndpointsTool(server, canAccess)
  getEndpointDetailTool(server, canAccess)
  getSchemaDetailTool(server, canAccess)
  getServiceMarkdownTool(server, canAccess)

  return server
}
