import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { eq } from 'drizzle-orm'
import { env } from '../env.js'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'

declare module 'hono' {
  interface ContextVariableMap {
    userId: string
    userRole: string
  }
}

export const jwtAuth: MiddlewareHandler = async (c, next) => {
  // Accept JWT from Authorization header (API clients) or httpOnly cookie (browser navigation)
  const auth = c.req.header('Authorization')
  const token = auth?.startsWith('Bearer ')
    ? auth.slice(7)
    : getCookie(c, 'speculo_token')

  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256')
    if (typeof payload.userId !== 'string') {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    c.set('userId', payload.userId)

    // Fetch and cache role for permission checks in routes
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
      columns: { role: true, isActive: true },
    })
    if (!user || !user.isActive) return c.json({ error: 'Unauthorized' }, 401)
    c.set('userRole', user.role)

    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}
