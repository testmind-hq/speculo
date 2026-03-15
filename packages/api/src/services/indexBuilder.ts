const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])

interface EndpointRow {
  specId: string
  serviceName: string
  branch: string
  method: string
  path: string
  operationId: string | null
  summary: string | null
  tags: string[]
}

export function extractEndpoints(
  spec: { paths?: Record<string, Record<string, unknown>> },
  serviceName: string,
  branch: string,
  specId: string,
): EndpointRow[] {
  const rows: EndpointRow[] = []
  const paths = spec.paths ?? {}

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [key, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(key.toLowerCase())) continue
      const op = operation as Record<string, unknown>
      rows.push({
        specId,
        serviceName,
        branch,
        method: key.toUpperCase(),
        path,
        operationId: (op.operationId as string | null) ?? null,
        summary: (op.summary as string | null) ?? null,
        tags: Array.isArray(op.tags) ? (op.tags as string[]) : [],
      })
    }
  }

  return rows
}
