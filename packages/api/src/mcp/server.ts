import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listServicesTool } from './tools/listServices.js'
import { searchEndpointsTool } from './tools/searchEndpoints.js'
import { getEndpointDetailTool } from './tools/getEndpointDetail.js'
import { getSchemaDetailTool } from './tools/getSchemaDetail.js'
import { getServiceMarkdownTool } from './tools/getServiceMarkdown.js'

export const mcpServer = new McpServer({
  name: 'speculo',
  version: '1.0.0',
})

listServicesTool(mcpServer)
searchEndpointsTool(mcpServer)
getEndpointDetailTool(mcpServer)
getSchemaDetailTool(mcpServer)
getServiceMarkdownTool(mcpServer)
