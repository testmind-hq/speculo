import { eq, or, isNull, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { webhookConfigs } from '../db/schema.js'

export type WebhookEventType =
  | 'spec.uploaded' | 'spec.updated' | 'service.deleted'
  | 'grant.created' | 'grant.revoked'
  | 'token.created' | 'token.revoked'
  | 'permission.changed'

export interface WebhookEvent {
  event?: WebhookEventType
  type?: string
  timestamp: string
  actor?: string
  service?: string
  team?: string
  detail?: Record<string, unknown>
  meta?: Record<string, unknown>
}

export interface WebhookProvider {
  send(url: string, payload: WebhookEvent): Promise<void>
}

export const feishuProvider: WebhookProvider = {
  async send(url, payload) {
    const event = payload.event ?? payload.type ?? 'unknown'
    const lines: string[] = [
      `Event: ${event}`,
      `Time: ${new Date(payload.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
    ]
    if (payload.actor) lines.push(`Actor: ${payload.actor}`)
    if (payload.service) lines.push(`Service: ${payload.service}`)
    if (payload.team) lines.push(`Team: ${payload.team}`)
    if (payload.detail) lines.push(`Detail: ${JSON.stringify(payload.detail)}`)
    if (payload.meta) lines.push(`Meta: ${JSON.stringify(payload.meta)}`)

    const text = lines.join('\n')
    const body = {
      msg_type: 'text',
      content: { text },
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {
      // Fire-and-forget: never throw
    })
  },
}

export const providers: Record<string, WebhookProvider> = {
  feishu: feishuProvider,
}

/**
 * Emit a webhook event. Queries active webhook_configs matching the event type
 * and the team (or global configs). Fire-and-forget — never throws.
 *
 * Scope: when teamIds is non-empty, both team-scoped and global configs fire.
 * When teamIds is empty (e.g., MCP token upload with no team context), only
 * global configs (teamId IS NULL) fire.
 */
export async function emitWebhookEvent(
  payload: WebhookEvent,
  teamIds: string[] = [],
): Promise<void> {
  try {
    const eventType = payload.event
    const configs = await db
      .select()
      .from(webhookConfigs)
      .where(
        and(
          eq(webhookConfigs.isActive, true),
          eventType
            ? sql`${webhookConfigs.events} @> ARRAY[${eventType}]::text[]`
            : sql`true`,
          teamIds.length > 0
            ? or(isNull(webhookConfigs.teamId), sql`${webhookConfigs.teamId} = ANY(${teamIds})`)
            : isNull(webhookConfigs.teamId),
        ),
      )

    await Promise.allSettled(
      configs.map(cfg => {
        const provider = providers[cfg.providerType] ?? feishuProvider
        return provider.send(cfg.url, payload)
      }),
    )
  } catch {
    // Intentionally silent
  }
}
