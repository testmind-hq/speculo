import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { services, specVersions } from '../db/schema.js'
import { createMarkdownFromOpenApi } from '@scalar/openapi-to-markdown'

export const llmsRouter = new Hono()

// Public — no auth required
llmsRouter.get('/docs/:service/:branch/llms.txt', async (c) => {
  const { service, branch } = c.req.param()

  const [row] = await db
    .select({ specContent: specVersions.specContent })
    .from(specVersions)
    .innerJoin(services, eq(specVersions.serviceId, services.id))
    .where(sql`${services.name} = ${service} AND ${specVersions.branch} = ${branch} AND ${specVersions.isLatest} = true`)

  if (!row) return c.text('Not found', 404)

  const spec = JSON.parse(row.specContent)
  const markdown = await createMarkdownFromOpenApi(spec)

  return c.text(markdown, 200, { 'Content-Type': 'text/plain; charset=utf-8' })
})
