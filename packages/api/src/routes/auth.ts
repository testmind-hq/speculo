import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import bcrypt from 'bcryptjs'
import { sign } from 'hono/jwt'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, mcpTokens } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'
import { env } from '../env.js'
import { randomBytes } from 'node:crypto'

export const authRouter = new OpenAPIHono()

// Apply jwtAuth to token management routes
authRouter.use('/api/tokens', jwtAuth)
authRouter.use('/api/tokens/*', jwtAuth)

const TokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: z.enum(['read', 'write']),
  prefix: z.string(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
})

authRouter.openapi(createRoute({
  method: 'post',
  path: '/auth/register',
  operationId: 'registerUser',
  tags: ['Auth'],
  summary: 'Register a new account',
  description: 'Create a new user account and return a signed JWT.',
  request: {
    body: {
      content: { 'application/json': { schema: z.object({ email: z.string().email(), password: z.string().min(8) }) } },
      required: true,
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ token: z.string(), userId: z.string() }) } }, description: 'Registered successfully' },
    409: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Email already registered' },
  },
}), async (c) => {
  const { email, password } = c.req.valid('json')
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) return c.json({ error: 'Email already registered' }, 409 as const)
  const passwordHash = await bcrypt.hash(password, 10)
  const [user] = await db.insert(users).values({ email, passwordHash, role: 'super_admin' }).returning()
  const token = await sign(
    { userId: user.id, exp: Math.floor(Date.now() / 1000) + env.JWT_EXPIRY_DAYS * 86400 },
    env.JWT_SECRET
  )
  return c.json({ token, userId: user.id }, 200 as const)
})

authRouter.openapi(createRoute({
  method: 'post',
  path: '/auth/login',
  operationId: 'loginUser',
  tags: ['Auth'],
  summary: 'Log in and receive a JWT',
  description: 'Authenticate with email and password and receive a signed JWT.',
  request: {
    body: {
      content: { 'application/json': { schema: z.object({ email: z.string().email(), password: z.string() }) } },
      required: true,
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ token: z.string(), userId: z.string() }) } }, description: 'Login successful' },
    401: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Invalid credentials' },
  },
}), async (c) => {
  const { email, password } = c.req.valid('json')
  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (!user) return c.json({ error: 'Invalid credentials' }, 401 as const)
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401 as const)
  const token = await sign(
    { userId: user.id, exp: Math.floor(Date.now() / 1000) + env.JWT_EXPIRY_DAYS * 86400 },
    env.JWT_SECRET
  )
  return c.json({ token, userId: user.id }, 200 as const)
})

authRouter.openapi(createRoute({
  method: 'get',
  path: '/api/tokens',
  operationId: 'listTokens',
  tags: ['MCP Tokens'],
  summary: 'List MCP tokens for the current user',
  description: 'Returns all MCP tokens belonging to the authenticated user.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { 'application/json': { schema: z.object({ tokens: z.array(TokenSchema) }) } }, description: 'Token list' },
  },
}), async (c) => {
  const userId = c.get('userId')
  const tokens = await db.select({
    id: mcpTokens.id,
    name: mcpTokens.name,
    scope: mcpTokens.scope,
    prefix: mcpTokens.prefix,
    lastUsedAt: mcpTokens.lastUsedAt,
    createdAt: mcpTokens.createdAt,
  }).from(mcpTokens).where(eq(mcpTokens.userId, userId))
  return c.json({ tokens }, 200 as const)
})

authRouter.openapi(createRoute({
  method: 'post',
  path: '/api/tokens',
  operationId: 'createToken',
  tags: ['MCP Tokens'],
  summary: 'Create an MCP token',
  description: 'Create a new MCP token. The full token value is returned once and cannot be retrieved again.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: z.object({ name: z.string().min(1), scope: z.enum(['read', 'write']) }) } },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ id: z.string(), name: z.string(), scope: z.enum(['read', 'write']), prefix: z.string(), createdAt: z.string(), token: z.string().describe('Full token — shown once') }),
        },
      },
      description: 'Token created',
    },
  },
}), async (c) => {
  const userId = c.get('userId')
  const { name, scope } = c.req.valid('json')
  const rawToken = 'speculo_mcp_' + randomBytes(24).toString('base64url')
  const prefix = rawToken.slice(0, 24)
  const tokenHash = await bcrypt.hash(rawToken, 10)
  const [token] = await db.insert(mcpTokens)
    .values({ userId, name, tokenHash, prefix, scope })
    .returning({ id: mcpTokens.id, name: mcpTokens.name, scope: mcpTokens.scope, prefix: mcpTokens.prefix, createdAt: mcpTokens.createdAt })
  return c.json({ ...token, token: rawToken }, 200 as const)
})

authRouter.openapi(createRoute({
  method: 'delete',
  path: '/api/tokens/{id}',
  operationId: 'deleteToken',
  tags: ['MCP Tokens'],
  summary: 'Revoke an MCP token',
  description: 'Revoke and permanently delete an MCP token.',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Token revoked' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Token not found' },
  },
}), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const result = await db.delete(mcpTokens)
    .where(and(eq(mcpTokens.id, id), eq(mcpTokens.userId, userId)))
    .returning({ id: mcpTokens.id })
  if (!result.length) return c.json({ error: 'Token not found' }, 404 as const)
  return c.json({ ok: true }, 200 as const)
})
