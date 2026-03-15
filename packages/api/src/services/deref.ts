import SwaggerParser from '@apidevtools/swagger-parser'

export async function derefSpec(spec: Record<string, unknown>): Promise<Record<string, unknown>> {
  // dereference() replaces all $ref with actual content
  return await SwaggerParser.dereference(
    structuredClone(spec) as Parameters<typeof SwaggerParser.dereference>[0]
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
