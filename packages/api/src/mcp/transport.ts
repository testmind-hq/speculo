import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { mcpTokens } from '../db/schema.js'
import { mcpServer } from './server.js'

export const mcpRouter = new Hono()

async function validateMcpToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  const prefix = token.slice(0, 24)
  const candidates = await db.select().from(mcpTokens).where(eq(mcpTokens.prefix, prefix))

  for (const candidate of candidates) {
    if (candidate.scope !== 'read') continue
    const valid = await bcrypt.compare(token, candidate.tokenHash)
    if (valid) {
      // Update last_used_at (fire and forget)
      db.update(mcpTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(mcpTokens.id, candidate.id))
        .catch(() => {})
      return true
    }
  }
  return false
}

mcpRouter.post('/mcp', async (c) => {
  const valid = await validateMcpToken(c.req.header('Authorization'))
  if (!valid) return c.json({ error: 'Unauthorized' }, 401)

  // Streamable HTTP: handle JSON-RPC POST
  try {
    const body = await c.req.json()
    // Return a basic error response since full MCP streaming requires Node.js http
    return c.json({ jsonrpc: '2.0', error: { code: -32000, message: 'Use SSE endpoint' }, id: body.id ?? null })
  } catch {
    return c.json({ error: 'Invalid request' }, 400)
  }
})

mcpRouter.get('/mcp', async (c) => {
  const valid = await validateMcpToken(c.req.header('Authorization'))
  if (!valid) return c.json({ error: 'Unauthorized' }, 401)

  return c.text('MCP SSE endpoint ready', 200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })
})

// Reference mcpServer to satisfy the import (used for future SSE transport integration)
void mcpServer
