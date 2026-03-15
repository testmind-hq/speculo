import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { services, specVersions } from '../db/schema.js'
import { env } from '../env.js'

export const docsRouter = new Hono()

docsRouter.get('/docs/:service/:branch', async (c) => {
  // Browser navigation: redirect to login instead of returning JSON 401
  const auth = c.req.header('Authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : getCookie(c, 'speculo_token')
  if (!token) return c.redirect('/login', 302)
  try {
    await verify(token, env.JWT_SECRET, 'HS256')
  } catch {
    return c.redirect('/login', 302)
  }
  const { service, branch } = c.req.param()

  const [row] = await db
    .select({ id: specVersions.id })
    .from(specVersions)
    .innerJoin(services, eq(specVersions.serviceId, services.id))
    .where(sql`${services.name} = ${service} AND ${specVersions.branch} = ${branch} AND ${specVersions.isLatest} = true`)

  if (!row) return c.json({ error: 'Not found' }, 404)

  // Serve spec via URL — never inline raw JSON into a <script> tag (XSS risk)
  const specUrl = `/api/specs/${encodeURIComponent(service)}/${encodeURIComponent(branch)}/openapi.json`

  return c.html(`<!doctype html>
<html>
  <head>
    <title>${service} · ${branch} — Speculo</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        spec: { url: '${specUrl}' },
        theme: 'purple',
        layout: 'modern',
        darkMode: true,
      })
    </script>
  </body>
</html>`)
})
