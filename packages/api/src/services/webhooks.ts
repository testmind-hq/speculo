import { eq, or, isNull, and, inArray, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { webhookConfigs } from '../db/schema.js'

export type WebhookEventType =
  | 'spec_uploaded' | 'spec_updated' | 'service_deleted'
  | 'grant_created' | 'grant_revoked'
  | 'token_created' | 'token_revoked'
  | 'team_created' | 'user_disabled'

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
    if (!eventType) return  // safety guard: no real event type = no dispatch
    const configs = await db
      .select()
      .from(webhookConfigs)
      .where(
        and(
          eq(webhookConfigs.isActive, true),
          sql`${webhookConfigs.events} @> ARRAY[${eventType}]::text[]`,
          teamIds.length > 0
            ? or(isNull(webhookConfigs.teamId), inArray(webhookConfigs.teamId, teamIds))
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
