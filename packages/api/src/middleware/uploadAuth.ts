import type { MiddlewareHandler } from 'hono'
import { verify } from 'hono/jwt'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { mcpTokens, users } from '../db/schema.js'
import { env } from '../env.js'

// Re-export ContextVariableMap augmentation (also declared in jwtAuth.ts)
declare module 'hono' {
  interface ContextVariableMap {
    userId: string
  }
}

// Accepts either a valid JWT or a write-scope MCP token
export const uploadAuth: MiddlewareHandler = async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = auth.slice(7)

  // Try JWT first — fetch role from DB (not JWT payload) so revocations take effect immediately
  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256')
    if (typeof payload.userId !== 'string') throw new Error('bad payload')
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
      columns: { role: true, isActive: true },
    })
    if (!user || !user.isActive) return c.json({ error: 'Unauthorized' }, 401)
    if (user.role !== 'super_admin' && user.role !== 'team_owner') {
      return c.json({ error: 'Forbidden: upload requires team_owner or super_admin role' }, 403)
    }
    c.set('userId', payload.userId)
    return await next()
  } catch {
    // Not a valid JWT — fall through to MCP token check
  }

  // Try write-scope MCP token
  // Tokens start with "speculo_mcp_" prefix — find candidates by prefix (first 24 chars)
  const prefix = token.slice(0, 24)
  const candidates = await db.select().from(mcpTokens)
    .where(eq(mcpTokens.prefix, prefix))

  for (const candidate of candidates) {
    if (candidate.scope !== 'write') continue
    const valid = await bcrypt.compare(token, candidate.tokenHash)
    if (valid) {
      c.set('userId', candidate.userId)
      // Update last_used_at (fire and forget)
      db.update(mcpTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(mcpTokens.id, candidate.id))
        .catch(() => {})
      return await next()
    }
  }

  return c.json({ error: 'Unauthorized' }, 401)
}
