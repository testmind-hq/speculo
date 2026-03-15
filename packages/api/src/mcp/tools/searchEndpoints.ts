import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { endpointIndex } from '../../db/schema.js'

export function searchEndpointsTool(server: McpServer) {
  server.tool(
    'search_endpoints',
    '搜索接口，返回匹配列表（最多10条）。先用此工具找到接口，再用 get_endpoint_detail 获取详情。',
    {
      service: z.string().describe('服务名，如 user-service'),
      branch: z.string().optional().describe('分支名，不填则搜索所有分支'),
      q: z.string().describe('搜索关键词'),
    },
    async ({ service, branch, q }) => {
      const pattern = `%${q}%`
      const conditions = [
        eq(endpointIndex.serviceName, service),
        sql`(${endpointIndex.path} ILIKE ${pattern} OR ${endpointIndex.summary} ILIKE ${pattern} OR ${endpointIndex.operationId} ILIKE ${pattern})`,
      ]
      if (branch) conditions.push(eq(endpointIndex.branch, branch))

      const results = await db
        .select({
          method: endpointIndex.method,
          path: endpointIndex.path,
          summary: endpointIndex.summary,
          operationId: endpointIndex.operationId,
          tags: endpointIndex.tags,
          branch: endpointIndex.branch,
        })
        .from(endpointIndex)
        .where(and(...conditions))
        .limit(10)

      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] }
    }
  )
}
