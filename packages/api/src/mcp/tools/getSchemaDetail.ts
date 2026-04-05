import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { safeSerialize, getDerefedSpec } from '../../services/deref.js'

export function getSchemaDetailTool(
  server: McpServer,
  canAccess: (service: string, branch?: string) => Promise<boolean>,
) {
  server.tool(
    'get_schema_detail',
    '获取数据模型完整 Schema 定义（$ref 已展开）',
    {
      service: z.string(),
      branch: z.string().default('main'),
      schemaName: z.string().describe('Schema 名称，如 UserProfile'),
    },
    async ({ service, branch, schemaName }) => {
      if (!await canAccess(service, branch)) {
        return { isError: true, content: [{ type: 'text' as const, text: `Access denied: ${service}` }] }
      }

      const spec = await getDerefedSpec(service, branch)
      if (!spec) {
        return { isError: true, content: [{ type: 'text' as const, text: `Service ${service}/${branch} not found` }] }
      }

      const components = spec.components as Record<string, unknown> | undefined
      const schemas = components?.schemas as Record<string, unknown> | undefined
      const schema = schemas?.[schemaName]

      if (!schema) {
        return { isError: true, content: [{ type: 'text' as const, text: `Schema ${schemaName} not found` }] }
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(safeSerialize(schema), null, 2) }] }
    }
  )
}
