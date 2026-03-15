import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listServicesTool } from './tools/listServices.js'
import { searchEndpointsTool } from './tools/searchEndpoints.js'
import { getEndpointDetailTool } from './tools/getEndpointDetail.js'
import { getSchemaDetailTool } from './tools/getSchemaDetail.js'
import { getServiceMarkdownTool } from './tools/getServiceMarkdown.js'

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'speculo', version: '1.0.0' })
  listServicesTool(server)
  searchEndpointsTool(server)
  getEndpointDetailTool(server)
  getSchemaDetailTool(server)
  getServiceMarkdownTool(server)
  return server
}
