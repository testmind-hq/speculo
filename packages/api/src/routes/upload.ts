import { Hono } from 'hono'
import { z } from 'zod'
import { sql, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { services, specVersions, endpointIndex } from '../db/schema.js'
import { uploadAuth } from '../middleware/uploadAuth.js'
import { normalizeSpec } from '../services/specProcessor.js'
import { extractEndpoints } from '../services/indexBuilder.js'
import { specCache } from '../services/cache.js'

export const uploadRouter = new Hono()

uploadRouter.post('/api/upload', uploadAuth, async (c) => {
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
    if (!file) return c.json({ error: 'Missing file' }, 400)
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
    if (!parsed.success) return c.json({ error: 'Invalid body', details: parsed.error.issues }, 400)
    ;({ service, branch, commitSha, specContent } = parsed.data)
    filename = 'openapi.json'
  }

  if (!service?.trim()) return c.json({ error: 'Missing service name' }, 400)
  if (!branch?.trim()) return c.json({ error: 'Missing branch name' }, 400)
  if (!specContent?.trim()) return c.json({ error: 'Missing spec content' }, 400)

  let normalized
  try {
    normalized = await normalizeSpec(specContent, filename)
  } catch (err: unknown) {
    return c.json({ error: 'Invalid spec', details: String(err) }, 400)
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
  })
})
