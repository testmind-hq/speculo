import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { db } from '../db/index.js'
import { mcpTokens, users } from '../db/schema.js'
import { createMcpServer } from './server.js'

export const mcpRouter = new Hono()

async function validateMcpToken(
  authHeader: string | undefined,
): Promise<{ userId: string; userRole: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const prefix = token.slice(0, 24)
  const candidates = await db.select().from(mcpTokens).where(eq(mcpTokens.prefix, prefix))

  for (const candidate of candidates) {
    if (candidate.scope !== 'read') continue
    const valid = await bcrypt.compare(token, candidate.tokenHash)
    if (valid) {
      db.update(mcpTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(mcpTokens.id, candidate.id))
        .catch(() => {})
      // Fetch the user's current role; also verify account is still active
      const user = await db.query.users.findFirst({
        where: and(eq(users.id, candidate.userId), eq(users.isActive, true)),
        columns: { role: true },
      })
      if (!user) return null  // account disabled — deny access
      return { userId: candidate.userId, userRole: user.role }
    }
  }
  return null
}

// Session store: maps session ID → transport instance
const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>()

mcpRouter.all('/mcp', async (c) => {
  // CORS preflight — let the cors middleware handle it without auth
  if (c.req.method === 'OPTIONS') return new Response(null, { status: 204 })

  const authResult = await validateMcpToken(c.req.header('Authorization'))
  if (!authResult) return c.json({ error: 'Unauthorized' }, 401)

  const { userId, userRole } = authResult
  const sessionId = c.req.header('Mcp-Session-Id')
  let transport: WebStandardStreamableHTTPServerTransport

  if (sessionId && sessions.has(sessionId)) {
    // Resume existing session — token is NOT re-validated on each request.
    // Known trade-off: if a token is revoked or a user is disabled mid-session,
    // the change takes effect only when the session ends and a new one is created.
    // MCP sessions are short-lived in practice, so this is acceptable.
    transport = sessions.get(sessionId)!
  } else if (!sessionId) {
    // New session: create transport + server with user's permission context
    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => { sessions.set(id, transport) },
      onsessionclosed: (id) => { sessions.delete(id) },
    })
    await createMcpServer(userId, userRole).connect(transport)
  } else {
    return c.json({ error: 'Session not found' }, 404)
  }

  return transport.handleRequest(c.req.raw)
})
