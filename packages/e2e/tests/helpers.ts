/**
 * Shared constants and helpers for e2e tests.
 */
import type { APIRequestContext } from '@playwright/test'

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com'
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme'
export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'e2e-user@speculo.test'
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'e2e-test-password-123'

/** Log in as admin via API and return the JWT. */
export async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post('/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  if (!res.ok()) throw new Error(`Admin login failed: ${await res.text()}`)
  const { token } = await res.json() as { token: string }
  return token
}

/** Upload a spec file via the API. */
export async function uploadSpec(
  request: APIRequestContext,
  token: string,
  service: string,
  branch: string,
  specYaml: string,
) {
  const res = await request.fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      service,
      branch,
      file: {
        name: 'spec.yaml',
        mimeType: 'application/x-yaml',
        buffer: Buffer.from(specYaml),
      },
    },
  })
  if (!res.ok()) throw new Error(`Upload failed for ${service}: ${await res.text()}`)
}

/** Delete a service by name (no-op if it doesn't exist). */
export async function deleteService(
  request: APIRequestContext,
  token: string,
  name: string,
) {
  const catalogRes = await request.get('/api/catalog', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!catalogRes.ok()) return
  const { services } = await catalogRes.json() as { services: { id: string; name: string }[] }
  const svc = services.find(s => s.name === name)
  if (svc) {
    await request.delete(`/api/catalog/${svc.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
}

/** Delete a user by email (no-op if not found). */
export async function deleteUser(
  request: APIRequestContext,
  token: string,
  email: string,
) {
  const res = await request.get('/api/admin/users', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok()) return
  const { users } = await res.json() as { users: { id: string; email: string }[] }
  const u = users.find(u => u.email === email)
  if (u) {
    await request.delete(`/api/admin/users/${u.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
}

/** Minimal 2-endpoint OpenAPI 3.1 spec. */
export function minimalSpec(title: string) {
  return `
openapi: "3.1.0"
info:
  title: "${title}"
  version: "1.0.0"
paths:
  /health:
    get:
      summary: Health check
      responses:
        "200":
          description: OK
  /items:
    get:
      summary: List items
      responses:
        "200":
          description: OK
`.trim()
}
