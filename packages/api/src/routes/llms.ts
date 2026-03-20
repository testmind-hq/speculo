import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { eq, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { services, specVersions, mcpTokens, users } from '../db/schema.js'
import { env } from '../env.js'
import { canAccessBranch } from '../services/permissions.js'
import { createMarkdownFromOpenApi } from '@scalar/openapi-to-markdown'

export const llmsRouter = new Hono()

// Resolve caller identity from JWT (Bearer or cookie) or read-scope MCP token.
// Returns { userId } on success, null if no valid credential present.
async function resolveAuth(c: { req: { header: (k: string) => string | undefined } }): Promise<{ userId: string } | null> {
  const authHeader = c.req.header('Authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  // getCookie needs the full Hono context — cast here; typesafe enough for internal use
  const cookieToken = getCookie(c as any, 'speculo_token')
  const token = bearer ?? cookieToken ?? null

  if (!token) return null

  // Try JWT
  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256')
    if (typeof payload.userId === 'string') {
      const user = await db.query.users.findFirst({
        where: eq(users.id, payload.userId),
        columns: { isActive: true },
      })
      if (user?.isActive) return { userId: payload.userId }
    }
  } catch {
    // not a JWT — fall through
  }

  // Try read-scope MCP token (Bearer only)
  if (bearer) {
    const prefix = bearer.slice(0, 24)
    const candidates = await db.select().from(mcpTokens).where(eq(mcpTokens.prefix, prefix))
    for (const candidate of candidates) {
      if (candidate.scope !== 'read') continue
      const valid = await bcrypt.compare(bearer, candidate.tokenHash)
      if (valid) {
        db.update(mcpTokens).set({ lastUsedAt: new Date() }).where(eq(mcpTokens.id, candidate.id)).catch(() => {})
        return { userId: candidate.userId }
      }
    }
  }

  return null
}

llmsRouter.get('/docs/:service/:branch/llms.txt', async (c) => {
  const { service, branch } = c.req.param()

  const identity = await resolveAuth(c)
  if (!identity) return c.text('Unauthorized', 401)

  const allowed = await canAccessBranch(identity.userId, service, branch)
  if (!allowed) return c.text('Forbidden', 403)

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
