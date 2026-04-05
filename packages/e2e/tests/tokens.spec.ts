/**
 * S5 — MCP Tokens
 * Runs in the `admin` project.
 */
import { test, expect } from '@playwright/test'

const RUN = Date.now()
const TOKEN_READ = `e2e-token-read-${RUN}`
const TOKEN_WRITE = `e2e-token-write-${RUN}`
const TOKEN_REVOKE = `e2e-token-revoke-${RUN}`

test.afterAll(async ({ request, baseURL }) => {
  // Revoke any e2e tokens left over (the revoke test cleans its own, others may remain)
  const loginRes = await request.post('/auth/login', {
    data: {
      email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
      password: process.env.ADMIN_PASSWORD ?? 'changeme',
    },
  })
  if (!loginRes.ok()) return
  const { token } = await loginRes.json() as { token: string }

  const listRes = await request.get('/api/tokens', { headers: { Authorization: `Bearer ${token}` } })
  if (!listRes.ok()) return
  const { tokens } = await listRes.json() as { tokens: { id: string; name: string }[] }

  for (const tk of tokens) {
    if (tk.name.startsWith('e2e-token-')) {
      await request.delete(`/api/tokens/${tk.id}`, { headers: { Authorization: `Bearer ${token}` } })
    }
  }
})

test('create a read token and verify it appears in the list', async ({ page }) => {
  await page.goto('/settings/tokens')

  await page.getByTestId('token-name-input').fill(TOKEN_READ)
  // Scope select defaults to "read" — no change needed
  await page.getByRole('button', { name: /^create$/i }).click()

  // One-time token alert appears with the token value
  const alert = page.getByTestId('token-created-alert')
  await expect(alert).toBeVisible({ timeout: 10_000 })
  await expect(alert).toContainText('speculo_mcp_')

  // Token row appears in the table
  await expect(page.getByRole('row').filter({ hasText: TOKEN_READ })).toBeVisible()
})

test('create a write token', async ({ page }) => {
  await page.goto('/settings/tokens')

  await page.getByTestId('token-name-input').fill(TOKEN_WRITE)

  // Switch scope to write
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: 'write' }).click()

  await page.getByRole('button', { name: /^create$/i }).click()

  await expect(page.getByTestId('token-created-alert')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('row').filter({ hasText: TOKEN_WRITE })).toBeVisible()
})

test('revoke a token removes it from the list', async ({ page }) => {
  await page.goto('/settings/tokens')

  await page.getByTestId('token-name-input').fill(TOKEN_REVOKE)
  await page.getByRole('button', { name: /^create$/i }).click()
  await expect(page.getByRole('row').filter({ hasText: TOKEN_REVOKE })).toBeVisible({ timeout: 10_000 })

  // Revoke
  await page.getByRole('row').filter({ hasText: TOKEN_REVOKE }).getByRole('button', { name: /revoke/i }).click()

  await expect(page.getByRole('row').filter({ hasText: TOKEN_REVOKE })).not.toBeVisible({ timeout: 10_000 })
})
