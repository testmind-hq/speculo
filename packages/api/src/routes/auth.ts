import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { sign } from 'hono/jwt'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, mcpTokens } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'
import { env } from '../env.js'
import { randomBytes } from 'node:crypto'

export const authRouter = new Hono()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

authRouter.post('/auth/register', zValidator('json', registerSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) return c.json({ error: 'Email already registered' }, 409)

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users)
  const role = 'super_admin' as const // MVP: all users are super_admin; RBAC in Phase 2

  const passwordHash = await bcrypt.hash(password, 10)
  const [user] = await db.insert(users).values({ email, passwordHash, role }).returning()

  const token = await sign(
    { userId: user.id, exp: Math.floor(Date.now() / 1000) + env.JWT_EXPIRY_DAYS * 86400 },
    env.JWT_SECRET
  )
  return c.json({ token, userId: user.id })
})

authRouter.post('/auth/login',
  zValidator('json', z.object({ email: z.string().email(), password: z.string() })),
  async (c) => {
    const { email, password } = c.req.valid('json')
    const user = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (!user) return c.json({ error: 'Invalid credentials' }, 401)

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

    const token = await sign(
      { userId: user.id, exp: Math.floor(Date.now() / 1000) + env.JWT_EXPIRY_DAYS * 86400 },
      env.JWT_SECRET
    )
    return c.json({ token, userId: user.id })
  }
)

// MCP Token management
authRouter.get('/api/tokens', jwtAuth, async (c) => {
  const userId = c.get('userId')
  const tokens = await db.select({
    id: mcpTokens.id,
    name: mcpTokens.name,
    scope: mcpTokens.scope,
    prefix: mcpTokens.prefix,
    lastUsedAt: mcpTokens.lastUsedAt,
    createdAt: mcpTokens.createdAt,
  }).from(mcpTokens).where(eq(mcpTokens.userId, userId))
  return c.json({ tokens })
})

authRouter.post('/api/tokens', jwtAuth,
  zValidator('json', z.object({
    name: z.string().min(1),
    scope: z.enum(['read', 'write']),
  })),
  async (c) => {
    const userId = c.get('userId')
    const { name, scope } = c.req.valid('json')

    const rawToken = 'speculo_mcp_' + randomBytes(24).toString('base64url')
    const prefix = rawToken.slice(0, 12) // "speculo_mcp_"
    const tokenHash = await bcrypt.hash(rawToken, 10)

    const [token] = await db.insert(mcpTokens)
      .values({ userId, name, tokenHash, prefix, scope })
      .returning({ id: mcpTokens.id, name: mcpTokens.name, scope: mcpTokens.scope, prefix: mcpTokens.prefix, createdAt: mcpTokens.createdAt })

    return c.json({ ...token, token: rawToken })
  }
)

authRouter.delete('/api/tokens/:id', jwtAuth, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()
  // Filter by both id AND userId to prevent deleting another user's token
  const result = await db.delete(mcpTokens)
    .where(sql`${mcpTokens.id} = ${id} AND ${mcpTokens.userId} = ${userId}`)
    .returning({ id: mcpTokens.id })
  if (!result.length) return c.json({ error: 'Token not found' }, 404)
  return c.json({ ok: true })
})
