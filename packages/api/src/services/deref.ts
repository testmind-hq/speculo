import SwaggerParser from '@apidevtools/swagger-parser'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { services, specVersions } from '../db/schema.js'
import { specCache } from './cache.js'

export async function derefSpec(spec: Record<string, unknown>): Promise<Record<string, unknown>> {
  // dereference() replaces all $ref with actual content
  return await SwaggerParser.dereference(
    structuredClone(spec) as unknown as Parameters<typeof SwaggerParser.dereference>[0]
  ) as Record<string, unknown>
}

export function safeSerialize(
  obj: unknown,
  visited = new WeakSet<object>()
): unknown {
  if (!obj || typeof obj !== 'object') return obj
  if (visited.has(obj)) return { type: 'object', description: '[Circular]' }
  visited.add(obj)
  if (Array.isArray(obj)) return obj.map((i) => safeSerialize(i, visited))
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, safeSerialize(v, visited)])
  )
}

// Shared helper: fetch spec from DB (or LRU cache) and dereference it
export async function getDerefedSpec(service: string, branch: string): Promise<Record<string, unknown> | null> {
  const cacheKey = `${service}:${branch}`
  const cached = specCache.get(cacheKey)
  if (cached) return cached

  const [row] = await db
    .select({ specContent: specVersions.specContent })
    .from(specVersions)
    .innerJoin(services, eq(specVersions.serviceId, services.id))
    .where(sql`${services.name} = ${service} AND ${specVersions.branch} = ${branch} AND ${specVersions.isLatest} = true`)

  if (!row) return null
  const spec = JSON.parse(row.specContent)
  const derefed = await derefSpec(spec)
  specCache.set(cacheKey, derefed)
  return derefed
}
