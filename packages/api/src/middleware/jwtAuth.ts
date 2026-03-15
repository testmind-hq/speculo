import type { MiddlewareHandler } from 'hono'
import { verify } from 'hono/jwt'
import { env } from '../env.js'

declare module 'hono' {
  interface ContextVariableMap {
    userId: string
  }
}

export const jwtAuth: MiddlewareHandler = async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const token = auth.slice(7)
    const payload = await verify(token, env.JWT_SECRET, 'HS256')
    c.set('userId', payload.userId as string)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}
