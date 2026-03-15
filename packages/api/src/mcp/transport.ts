import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { db } from '../db/index.js'
import { mcpTokens } from '../db/schema.js'
import { createMcpServer } from './server.js'

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
      db.update(mcpTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(mcpTokens.id, candidate.id))
        .catch(() => {})
      return true
    }
  }
  return false
}

// Session store: maps session ID → transport instance
const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>()

mcpRouter.all('/mcp', async (c) => {
  const valid = await validateMcpToken(c.req.header('Authorization'))
  if (!valid) return c.json({ error: 'Unauthorized' }, 401)

  const sessionId = c.req.header('Mcp-Session-Id')
  let transport: WebStandardStreamableHTTPServerTransport

  if (sessionId && sessions.has(sessionId)) {
    // Resume existing session
    transport = sessions.get(sessionId)!
  } else if (!sessionId) {
    // New session: create transport + server
    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => { sessions.set(id, transport) },
      onsessionclosed: (id) => { sessions.delete(id) },
    })
    await createMcpServer().connect(transport)
  } else {
    // Session ID provided but not found (e.g. after server restart)
    return c.json({ error: 'Session not found' }, 404)
  }

  return transport.handleRequest(c.req.raw)
})
