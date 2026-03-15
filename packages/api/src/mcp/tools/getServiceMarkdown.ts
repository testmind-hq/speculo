import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { createMarkdownFromOpenApi } from '@scalar/openapi-to-markdown'
import { db } from '../../db/index.js'
import { services, specVersions } from '../../db/schema.js'

export function getServiceMarkdownTool(server: McpServer) {
  server.tool(
    'get_service_markdown',
    '获取整个服务的 LLM 友好 Markdown 概览。适合快速了解一个服务有哪些接口和能力，再用 search_endpoints 做精准检索。',
    {
      service: z.string().describe('服务名，如 user-service'),
      branch: z.string().default('main').describe('分支名'),
    },
    async ({ service, branch }) => {
      const [row] = await db
        .select({ specContent: specVersions.specContent })
        .from(specVersions)
        .innerJoin(services, eq(specVersions.serviceId, services.id))
        .where(sql`${services.name} = ${service} AND ${specVersions.branch} = ${branch} AND ${specVersions.isLatest} = true`)

      if (!row) {
        return { isError: true, content: [{ type: 'text' as const, text: `Service ${service}/${branch} not found` }] }
      }

      const spec = JSON.parse(row.specContent)
      const markdown = await createMarkdownFromOpenApi(spec)
      return { content: [{ type: 'text' as const, text: markdown }] }
    }
  )
}
