import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { env } from '../env.js'

declare module 'hono' {
  interface ContextVariableMap {
    userId: string
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
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}
