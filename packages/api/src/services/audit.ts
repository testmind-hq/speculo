import { db } from '../db/index.js'
import { auditLogs } from '../db/schema.js'

export type AuditAction =
  | 'login' | 'spec_uploaded' | 'spec_updated' | 'service_deleted'
  | 'grant_created' | 'grant_revoked' | 'token_created' | 'token_revoked'
  | 'user_created' | 'user_disabled' | 'team_created'

export interface LogEventOptions {
  userId?: string | null
  action: AuditAction
  targetId?: string
  targetName?: string
  meta?: Record<string, unknown>
}

/** Fire-and-forget audit log write. Never throws — audit failures must not block the request. */
export async function logEvent(opts: LogEventOptions): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: opts.userId ?? null,
      action: opts.action,
      targetId: opts.targetId ?? null,
      targetName: opts.targetName ?? null,
      meta: opts.meta ? JSON.stringify(opts.meta) : null,
    })
  } catch {
    // Intentionally silent — audit log failures should never break the main flow
  }
}
