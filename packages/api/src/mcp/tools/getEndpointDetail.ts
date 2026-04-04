import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { safeSerialize, getDerefedSpec } from '../../services/deref.js'

export function getEndpointDetailTool(
  server: McpServer,
  canAccess: (service: string, branch?: string) => Promise<boolean>,
) {
  server.tool(
    'get_endpoint_detail',
    '获取单个接口完整文档（$ref 已展开）',
    {
      service: z.string(),
      branch: z.string().default('main'),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
      path: z.string().describe('接口路径，如 /users/{id}'),
    },
    async ({ service, branch, method, path }) => {
      if (!await canAccess(service, branch)) {
        return { isError: true, content: [{ type: 'text' as const, text: `Access denied: ${service}` }] }
      }

      const spec = await getDerefedSpec(service, branch)
      if (!spec) {
        return { isError: true, content: [{ type: 'text' as const, text: `Service ${service}/${branch} not found` }] }
      }

      const paths = spec.paths as Record<string, Record<string, unknown>> | undefined
      const pathItem = paths?.[path]
      if (!pathItem) {
        return { isError: true, content: [{ type: 'text' as const, text: `Path ${path} not found` }] }
      }

      const operation = pathItem[method.toLowerCase()]
      if (!operation) {
        return { isError: true, content: [{ type: 'text' as const, text: `Method ${method} not found for ${path}` }] }
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(safeSerialize(operation), null, 2) }] }
    }
  )
}
