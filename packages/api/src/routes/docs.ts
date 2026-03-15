import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { services, specVersions } from '../db/schema.js'

export const docsRouter = new Hono()

docsRouter.get('/docs/:service/:branch', async (c) => {
  const { service, branch } = c.req.param()

  const [row] = await db
    .select({ specContent: specVersions.specContent })
    .from(specVersions)
    .innerJoin(services, eq(specVersions.serviceId, services.id))
    .where(sql`${services.name} = ${service} AND ${specVersions.branch} = ${branch} AND ${specVersions.isLatest} = true`)

  if (!row) return c.json({ error: 'Not found' }, 404)

  // Inline spec into HTML — Scalar JS does not fetch it separately
  const specJson = row.specContent

  return c.html(`<!doctype html>
<html>
  <head>
    <title>${service} · ${branch} — Speculo</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body>
    <script>
      window.__SPECULO_SPEC__ = ${specJson};
    </script>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        spec: { content: window.__SPECULO_SPEC__ },
        theme: 'purple',
        layout: 'modern',
        darkMode: true,
      })
    </script>
  </body>
</html>`)
})
