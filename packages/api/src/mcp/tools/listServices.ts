import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { inArray, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { services, specVersions } from '../../db/schema.js'

export function listServicesTool(
  server: McpServer,
  getAccessibleIds: () => Promise<Set<string> | null>,
) {
  server.tool('list_services', '列出所有内部 API 服务和分支', {}, async () => {
    const accessibleIds = await getAccessibleIds()

    if (accessibleIds !== null && accessibleIds.size === 0) {
      return { content: [{ type: 'text' as const, text: '[]' }] }
    }

    let query = db
      .select({
        name: services.name,
        branch: specVersions.branch,
        endpointCount: specVersions.endpointCount,
        uploadedAt: specVersions.uploadedAt,
      })
      .from(services)
      .innerJoin(specVersions, sql`${specVersions.serviceId} = ${services.id} AND ${specVersions.isLatest} = true`)
      .$dynamic()

    if (accessibleIds !== null) {
      query = query.where(inArray(services.id, [...accessibleIds]))
    }

    const rows = await query.orderBy(services.name, specVersions.branch)
    return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] }
  })
}
