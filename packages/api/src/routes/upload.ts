import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { sql, eq, and, notInArray } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { db } from '../db/index.js'
import { services, specVersions, endpointIndex } from '../db/schema.js'
import { uploadAuth } from '../middleware/uploadAuth.js'
import { normalizeSpec } from '../services/specProcessor.js'
import { extractEndpoints } from '../services/indexBuilder.js'
import { specCache } from '../services/cache.js'
import { getDefaultTeamId } from '../services/permissions.js'
import { logEvent } from '../services/audit.js'
import { emitWebhookEvent } from '../services/webhooks.js'

export const uploadRouter = new OpenAPIHono()

uploadRouter.use('/api/upload', uploadAuth)

uploadRouter.openapi(createRoute({
  method: 'post',
  path: '/api/upload',
  operationId: 'uploadSpec',
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
            unchanged: z.boolean().optional().describe('true when spec hash matches current latest — no write performed'),
          }),
        },
      },
      description: 'Spec uploaded and indexed',
    },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Invalid spec or missing fields' },
    409: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Concurrent upload conflict' },
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
  const specHash = createHash('sha256').update(specJson).digest('hex')
  const endpointRows = extractEndpoints(normalized.spec as any, service, branch, 'pending')

  // Upsert service — assign to default team on first creation
  const defaultTeamId = await getDefaultTeamId()
  await db.insert(services).values({ name: service!, teamId: defaultTeamId }).onConflictDoNothing()
  const [svc] = await db.select({ id: services.id, teamId: services.teamId }).from(services).where(eq(services.name, service!))
  if (!svc) return c.json({ error: 'Service not found after upsert' }, 400 as const)

  // Dedup: if the current latest has the same hash, skip the write entirely
  const [current] = await db
    .select({ id: specVersions.id, specHash: specVersions.specHash })
    .from(specVersions)
    .where(sql`${specVersions.serviceId} = ${svc.id} AND ${specVersions.branch} = ${branch} AND ${specVersions.isLatest} = true`)

  if (current?.specHash === specHash) {
    return c.json({
      service,
      branch,
      endpointCount: endpointRows.length,
      wasConverted: normalized.wasConverted,
      warnings: normalized.warnings,
      unchanged: true,
    }, 200 as const)
  }

  try { await db.transaction(async (tx) => {
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
      specHash,
      endpointCount: endpointRows.length,
      isLatest: true,
    }).returning({ id: specVersions.id })

    // Delete old endpoint index rows for this service+branch (cascades via specId)
    if (current) {
      await tx.delete(endpointIndex).where(eq(endpointIndex.specId, current.id))
    }

    // Prune: keep only the latest 5 spec_versions per service+branch (retains history for diff)
    // Run AFTER the insert so the new version is included in the top-5 selection.
    const latest5 = await tx
      .select({ id: specVersions.id })
      .from(specVersions)
      .where(and(eq(specVersions.serviceId, svc.id), eq(specVersions.branch, branch!)))
      .orderBy(sql`${specVersions.uploadedAt} DESC`)
      .limit(5)
    const keepIds = latest5.map(r => r.id)
    // Guard: notInArray with an empty array produces invalid SQL — only prune once we have >= 5.
    if (keepIds.length >= 5) {
      await tx.delete(specVersions).where(
        and(
          eq(specVersions.serviceId, svc.id),
          eq(specVersions.branch, branch!),
          notInArray(specVersions.id, keepIds),
        )
      )
    }

    // Insert new endpoint index
    if (endpointRows.length > 0) {
      await tx.insert(endpointIndex).values(
        endpointRows.map(r => ({ ...r, specId: newSpec.id }))
      )
    }
  }) } catch (err: unknown) {
    // Unique-violation (23505) can occur when two uploads race on the same service+branch
    const pg = err as { code?: string }
    if (pg.code === '23505') return c.json({ error: 'Concurrent upload conflict — retry' }, 409 as const)
    throw err
  }

  // Invalidate cache after commit
  specCache.delete(`${service}:${branch}`)

  // Audit: distinguish first upload vs update
  void logEvent({
    userId: c.get('userId') ?? null,
    action: current ? 'spec_updated' : 'spec_uploaded',
    targetId: svc.id,
    targetName: service,
    meta: { branch, commitSha: commitSha ?? null, endpointCount: endpointRows.length },
  })
  void emitWebhookEvent({
    event: current ? 'spec_updated' : 'spec_uploaded',
    service,
    timestamp: new Date().toISOString(),
    meta: { branch, commitSha: commitSha ?? null, endpointCount: endpointRows.length },
  }, svc.teamId ? [svc.teamId] : [])

  return c.json({
    service,
    branch,
    endpointCount: endpointRows.length,
    wasConverted: normalized.wasConverted,
    warnings: normalized.warnings,
    unchanged: false,
  }, 200 as const)
})
