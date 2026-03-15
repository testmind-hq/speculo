import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { services, specVersions } from '../../db/schema.js'

export function listServicesTool(server: McpServer) {
  server.tool('list_services', '列出所有内部 API 服务和分支', {}, async () => {
    const rows = await db
      .select({
        name: services.name,
        branch: specVersions.branch,
        endpointCount: specVersions.endpointCount,
        uploadedAt: specVersions.uploadedAt,
      })
      .from(services)
      .innerJoin(specVersions, sql`${specVersions.serviceId} = ${services.id} AND ${specVersions.isLatest} = true`)
      .orderBy(services.name, specVersions.branch)

    return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] }
  })
}
