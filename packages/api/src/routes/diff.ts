import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { specVersions, services } from '../db/schema.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

export const diffRouter = new OpenAPIHono()
diffRouter.use('/api/diff', jwtAuth)
diffRouter.use('/api/specs/:service/versions', jwtAuth)

type ParsedSpec = { paths?: Record<string, Record<string, { operationId?: string; summary?: string }>> }

interface EndpointInfo {
  method: string
  path: string
  operationId?: string
  summary?: string
}

const HTTP_METHODS = ['get','post','put','patch','delete','head','options']

function extractEndpointMap(spec: ParsedSpec): Map<string, EndpointInfo> {
  const map = new Map<string, EndpointInfo>()
  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(methods ?? {})) {
      if (HTTP_METHODS.includes(method)) {
        const key = `${method.toUpperCase()} ${path}`
        map.set(key, { method: method.toUpperCase(), path, operationId: op.operationId, summary: op.summary })
      }
    }
  }
  return map
}

const EndpointDiffItem = z.object({
  method: z.string(),
  path: z.string(),
  operationId: z.string().optional(),
  summary: z.string().optional(),
})

diffRouter.openapi(createRoute({
  method: 'get',
  path: '/api/diff',
  operationId: 'diffSpecs',
  tags: ['Specs'],
  summary: 'Diff two spec versions by ID',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({ from: z.string(), to: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            added: z.array(EndpointDiffItem),
            removed: z.array(EndpointDiffItem),
            modified: z.array(z.object({ before: EndpointDiffItem, after: EndpointDiffItem })),
          }),
        },
      },
      description: 'Diff result',
    },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Version not found' },
  },
}), async (c) => {
  const { from, to } = c.req.valid('query')

  const [fromVer, toVer] = await Promise.all([
    db.query.specVersions.findFirst({ where: eq(specVersions.id, from) }),
    db.query.specVersions.findFirst({ where: eq(specVersions.id, to) }),
  ])
  if (!fromVer) return c.json({ error: `Version not found: ${from}` }, 404 as const)
  if (!toVer) return c.json({ error: `Version not found: ${to}` }, 404 as const)

  const fromSpec: ParsedSpec = JSON.parse(fromVer.specContent)
  const toSpec: ParsedSpec = JSON.parse(toVer.specContent)

  const fromMap = extractEndpointMap(fromSpec)
  const toMap = extractEndpointMap(toSpec)

  const added: EndpointInfo[] = []
  const removed: EndpointInfo[] = []
  const modified: { before: EndpointInfo; after: EndpointInfo }[] = []

  for (const [key, ep] of toMap) {
    if (!fromMap.has(key)) {
      added.push(ep)
    } else {
      const before = fromMap.get(key)!
      if (before.operationId !== ep.operationId || before.summary !== ep.summary) {
        modified.push({ before, after: ep })
      }
    }
  }
  for (const [key, ep] of fromMap) {
    if (!toMap.has(key)) removed.push(ep)
  }

  return c.json({ added, removed, modified }, 200 as const)
})

diffRouter.openapi(createRoute({
  method: 'get',
  path: '/api/specs/:service/versions',
  operationId: 'listSpecVersions',
  tags: ['Specs'],
  summary: 'List retained spec versions for a service branch',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ service: z.string() }),
    query: z.object({ branch: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            versions: z.array(z.object({
              id: z.string(),
              branch: z.string(),
              commitSha: z.string().nullable(),
              isLatest: z.boolean(),
              endpointCount: z.number(),
              uploadedAt: z.string(),
            })),
          }),
        },
      },
      description: 'Version list',
    },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Service not found' },
  },
}), async (c) => {
  const { service } = c.req.valid('param')
  const { branch } = c.req.valid('query')

  const svc = await db.query.services.findFirst({ where: eq(services.name, service) })
  if (!svc) return c.json({ error: 'Service not found' }, 404 as const)

  const versions = await db.query.specVersions.findMany({
    where: and(eq(specVersions.serviceId, svc.id), eq(specVersions.branch, branch)),
    columns: { id: true, branch: true, commitSha: true, isLatest: true, endpointCount: true, uploadedAt: true },
    orderBy: [desc(specVersions.uploadedAt)],
  })

  return c.json({
    versions: versions.map(v => ({ ...v, uploadedAt: v.uploadedAt.toISOString() })),
  }, 200 as const)
})
