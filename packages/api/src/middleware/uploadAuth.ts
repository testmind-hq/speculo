import type { MiddlewareHandler } from 'hono'
import { verify } from 'hono/jwt'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { db } from '../db/index.js'
import { mcpTokens } from '../db/schema.js'
import { env } from '../env.js'

// Accepts either a valid JWT or a write-scope MCP token
export const uploadAuth: MiddlewareHandler = async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = auth.slice(7)

  // Try JWT first
  try {
    const payload = await verify(token, env.JWT_SECRET)
    if (typeof payload.userId !== 'string') throw new Error('bad payload')
    c.set('userId', payload.userId)
    return await next()
  } catch {
    // Not a valid JWT — try MCP token
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
      return await next()
    }
  }

  return c.json({ error: 'Unauthorized' }, 401)
}
