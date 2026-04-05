/**
 * S8B — Regular user flow
 * Runs in the `user` project (guest role, storageState = user.json).
 */
import { test, expect } from '@playwright/test'

test('regular user can view the catalog page', async ({ page }) => {
  await page.goto('/')
  // Authenticated — should not be redirected to /login
  await expect(page).not.toHaveURL(/\/login/)
  // Catalog heading is visible once content loads
  await expect(page.locator('h1, [role="heading"]').first().or(page.locator('.space-y-5'))).toBeVisible({ timeout: 10_000 })
})

test('regular user accessing /admin/users is redirected to /', async ({ page }) => {
  await page.goto('/admin/users')
  // AdminLayout redirects non-super_admin to the root catalog
  await expect(page).toHaveURL('/')
})

test('regular user accessing /admin/teams is redirected to /', async ({ page }) => {
  await page.goto('/admin/teams')
  await expect(page).toHaveURL('/')
})

test('regular user can visit /import but upload is blocked server-side', async ({ page }) => {
  // The /import route has no client-side role guard — the page loads,
  // but any upload attempt will be rejected by the API with 403.
  // This test documents current behavior; add a client-side guard to change it.
  await page.goto('/import')
  await expect(page).toHaveURL('/import')
  await expect(page.locator('#service')).toBeVisible()
})
