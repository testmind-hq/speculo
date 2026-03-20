import { eq, or, isNull, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { webhookConfigs } from '../db/schema.js'

export type WebhookEventType =
  | 'spec.uploaded' | 'spec.updated' | 'service.deleted'
  | 'grant.created' | 'grant.revoked'
  | 'token.created' | 'token.revoked'
  | 'permission.changed'

export interface WebhookPayload {
  event: WebhookEventType
  timestamp: string
  actor?: string
  service?: string
  team?: string
  detail?: Record<string, unknown>
}

interface WebhookProvider {
  send(payload: WebhookPayload, url: string): Promise<void>
}

const feishuProvider: WebhookProvider = {
  async send(payload, url) {
    const title = `[Speculo] ${payload.event}`
    const lines: string[] = [
      `**Event:** ${payload.event}`,
      `**Time:** ${new Date(payload.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
    ]
    if (payload.actor) lines.push(`**Actor:** ${payload.actor}`)
    if (payload.service) lines.push(`**Service:** ${payload.service}`)
    if (payload.team) lines.push(`**Team:** ${payload.team}`)
    if (payload.detail) lines.push(`**Detail:** ${JSON.stringify(payload.detail)}`)

    const body = {
      msg_type: 'interactive',
      card: {
        header: { title: { tag: 'plain_text', content: title }, template: 'blue' },
        elements: [{ tag: 'div', text: { tag: 'lark_md', content: lines.join('\n') } }],
      },
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Feishu webhook failed: ${res.status}`)
  },
}

const providers: Record<string, WebhookProvider> = {
  feishu: feishuProvider,
}

/**
 * Emit a webhook event. Queries active webhook_configs matching the event type
 * and the team (or global configs). Fire-and-forget — never throws.
 *
 * Scope: when teamId is provided, both team-scoped and global configs fire.
 * When teamId is absent (e.g., MCP token upload with no team context), only
 * global configs (teamId IS NULL) fire.
 */
export async function emitWebhookEvent(
  payload: WebhookPayload,
  teamId?: string | null,
): Promise<void> {
  try {
    const configs = await db
      .select()
      .from(webhookConfigs)
      .where(
        and(
          eq(webhookConfigs.isActive, true),
          sql`${webhookConfigs.events} @> ARRAY[${payload.event}]::text[]`,
          teamId
            ? or(isNull(webhookConfigs.teamId), eq(webhookConfigs.teamId, teamId))
            : isNull(webhookConfigs.teamId),
        ),
      )

    await Promise.allSettled(
      configs.map(cfg => {
        const provider = providers[cfg.providerType] ?? feishuProvider
        return provider.send(payload, cfg.url)
      }),
    )
  } catch {
    // Intentionally silent
  }
}
