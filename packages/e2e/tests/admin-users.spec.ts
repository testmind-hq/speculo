/**
 * S8 — Admin › Users
 * Runs in the `admin` project.
 *
 * A test user is created in beforeAll (via API) so that all tests are independent
 * of each other — no test depends on a previous test having run.
 */
import { test, expect } from '@playwright/test'
import { adminToken, deleteUser } from './helpers.js'

const NEW_USER_EMAIL = `e2e-new-${Date.now()}@speculo.test`
const NEW_USER_PASSWORD = 'e2e-new-password-123'

test.beforeAll(async ({ request }) => {
  const token = await adminToken(request)
  const res = await request.post('/auth/register', {
    data: { email: NEW_USER_EMAIL, password: NEW_USER_PASSWORD },
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`Could not create test user for admin-users tests: ${await res.text()}`)
  }
})

test.afterAll(async ({ request }) => {
  const token = await adminToken(request)
  await deleteUser(request, token, NEW_USER_EMAIL)
})

test('new user appears in admin user list', async ({ page }) => {
  await page.goto('/admin/users')
  await expect(page.getByRole('cell', { name: NEW_USER_EMAIL })).toBeVisible({ timeout: 10_000 })
})

test('admin can create an additional user via the UI', async ({ page }) => {
  const extraEmail = `e2e-extra-${Date.now()}@speculo.test`
  await page.goto('/admin/users')

  await page.getByRole('button', { name: /create user/i }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('input[type=email]').fill(extraEmail)
  await dialog.locator('input[type=password]').fill('extra-password-456')
  await dialog.getByRole('button', { name: /^create$/i }).click()

  // Dialog closes and new user appears in table
  await expect(dialog).not.toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('cell', { name: extraEmail })).toBeVisible()

  // Cleanup: delete the extra user via API
  const token = await adminToken(page.request)
  await deleteUser(page.request, token, extraEmail)
})

test('admin can change a user role', async ({ page }) => {
  await page.goto('/admin/users')

  const row = page.getByRole('row').filter({ hasText: NEW_USER_EMAIL })
  await expect(row).toBeVisible({ timeout: 10_000 })

  await row.getByRole('combobox').click()
  await page.getByRole('option', { name: 'team_member' }).click()

  // Reload to confirm persistence
  await page.reload()
  const updatedRow = page.getByRole('row').filter({ hasText: NEW_USER_EMAIL })
  await expect(updatedRow.getByRole('combobox')).toHaveText(/team_member/)
})

test('admin can deactivate and reactivate a user', async ({ page }) => {
  await page.goto('/admin/users')

  const row = page.getByRole('row').filter({ hasText: NEW_USER_EMAIL })
  await expect(row).toBeVisible({ timeout: 10_000 })

  // Deactivate
  await row.getByRole('button', { name: /deactivate/i }).click()
  await expect(row.getByRole('button', { name: /activate/i })).toBeVisible()

  // Reactivate
  await row.getByRole('button', { name: /activate/i }).click()
  await expect(row.getByRole('button', { name: /deactivate/i })).toBeVisible()
})

test('admin can delete a user', async ({ page }) => {
  // Create a separate throwaway user for this test so the shared NEW_USER_EMAIL remains intact
  const throwawayEmail = `e2e-del-${Date.now()}@speculo.test`
  const token = await adminToken(page.request)
  await page.request.post('/auth/register', {
    data: { email: throwawayEmail, password: 'throwaway-pass-789' },
    headers: { Authorization: `Bearer ${token}` },
  })

  await page.goto('/admin/users')
  const row = page.getByRole('row').filter({ hasText: throwawayEmail })
  await expect(row).toBeVisible({ timeout: 10_000 })

  await row.getByRole('button', { name: /delete/i }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^delete$/i }).click()

  await expect(page.getByRole('cell', { name: throwawayEmail })).not.toBeVisible({ timeout: 10_000 })
})
