import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { sql, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { services, specVersions, endpointIndex } from '../db/schema.js'
import { uploadAuth } from '../middleware/uploadAuth.js'
import { normalizeSpec } from '../services/specProcessor.js'
import { extractEndpoints } from '../services/indexBuilder.js'
import { specCache } from '../services/cache.js'

export const uploadRouter = new OpenAPIHono()

uploadRouter.use('/api/upload', uploadAuth)

uploadRouter.openapi(createRoute({
  method: 'post',
  path: '/api/upload',
  tags: ['Upload'],
  summary: 'Upload an OpenAPI spec for a service',
  description: 'Accepts multipart/form-data (with a `file` field) or application/json (with `specContent` string). Auth: JWT or write-scope MCP token.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            service: z.string().min(1),
            branch: z.string().min(1),
            commitSha: z.string().optional(),
            specContent: z.string().min(1).describe('Raw OpenAPI YAML or JSON string'),
          }),
        },
        'multipart/form-data': {
          schema: z.object({
            service: z.string(),
            branch: z.string(),
            commit_sha: z.string().optional(),
            file: z.any().describe('OpenAPI file (.yaml, .yml, .json)'),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            service: z.string(),
            branch: z.string(),
            endpointCount: z.number(),
            wasConverted: z.boolean(),
            warnings: z.array(z.string()),
          }),
        },
      },
      description: 'Spec uploaded and indexed',
    },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Invalid spec or missing fields' },
  },
}), async (c) => {
  let service: string | undefined
  let branch: string | undefined
  let commitSha: string | undefined
  let specContent: string | undefined
  let filename = 'openapi.json'

  const contentType = c.req.header('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.formData()
    service = form.get('service')?.toString()
    branch = form.get('branch')?.toString()
    commitSha = form.get('commit_sha')?.toString()
    const file = form.get('file') as File | null
    if (!file) return c.json({ error: 'Missing file' }, 400 as const)
    filename = file.name
    specContent = await file.text()
  } else {
    const body = await c.req.json()
    const parsed = z.object({
      service: z.string().min(1),
      branch: z.string().min(1),
      commitSha: z.string().optional(),
      specContent: z.string().min(1),
    }).safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid body' }, 400 as const)
    ;({ service, branch, commitSha, specContent } = parsed.data)
    filename = 'openapi.json'
  }

  if (!service?.trim()) return c.json({ error: 'Missing service name' }, 400 as const)
  if (!branch?.trim()) return c.json({ error: 'Missing branch name' }, 400 as const)
  if (!specContent?.trim()) return c.json({ error: 'Missing spec content' }, 400 as const)

  let normalized
  try {
    normalized = await normalizeSpec(specContent, filename)
  } catch (err: unknown) {
    return c.json({ error: String(err) }, 400 as const)
  }

  const specJson = JSON.stringify(normalized.spec)
  const endpointRows = extractEndpoints(normalized.spec as any, service, branch, 'pending')

  await db.transaction(async (tx) => {
    // Upsert service
    await tx.insert(services).values({ name: service! }).onConflictDoNothing()
    const [svc] = await tx.select({ id: services.id }).from(services).where(eq(services.name, service!))

    // Find current latest
    const [current] = await tx.select({ id: specVersions.id })
      .from(specVersions)
      .where(sql`${specVersions.serviceId} = ${svc.id} AND ${specVersions.branch} = ${branch} AND ${specVersions.isLatest} = true`)

    // Unset previous latest
    await tx.update(specVersions)
      .set({ isLatest: false })
      .where(sql`${specVersions.serviceId} = ${svc.id} AND ${specVersions.branch} = ${branch}`)

    // Insert new spec version
    const [newSpec] = await tx.insert(specVersions).values({
      serviceId: svc.id,
      branch: branch!,
      commitSha: commitSha ?? null,
      specContent: specJson,
      endpointCount: endpointRows.length,
      isLatest: true,
    }).returning({ id: specVersions.id })

    // Delete old endpoint index
    if (current) {
      await tx.delete(endpointIndex).where(eq(endpointIndex.specId, current.id))
    }

    // Insert new endpoint index
    if (endpointRows.length > 0) {
      await tx.insert(endpointIndex).values(
        endpointRows.map(r => ({ ...r, specId: newSpec.id }))
      )
    }
  })

  // Invalidate cache after commit
  specCache.delete(`${service}:${branch}`)

  return c.json({
    service,
    branch,
    endpointCount: endpointRows.length,
    wasConverted: normalized.wasConverted,
    warnings: normalized.warnings,
  }, 200 as const)
})
