/**
 * S2 — Catalog
 * Runs in the `admin` project.
 */
import { test, expect } from '@playwright/test'
import { adminToken, deleteService, minimalSpec, uploadSpec } from './helpers.js'

const SERVICE = `e2e-catalog-${Date.now()}`
const THROWAWAY = `${SERVICE}-del`

test.beforeAll(async ({ request }) => {
  const token = await adminToken(request)
  await uploadSpec(request, token, SERVICE, 'main', minimalSpec(SERVICE))
})

test.afterAll(async ({ request }) => {
  const token = await adminToken(request)
  await deleteService(request, token, SERVICE)
  await deleteService(request, token, THROWAWAY)
})

test('catalog page loads and shows uploaded service', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(SERVICE)).toBeVisible({ timeout: 10_000 })
})

test('service card shows branch and endpoint count', async ({ page }) => {
  await page.goto('/')

  // Find the service card header row (div[role="button"] containing the service name)
  const header = page.locator('[role="button"]').filter({ has: page.getByText(SERVICE, { exact: true }) })
  await expect(header).toBeVisible({ timeout: 10_000 })

  // Expand the card to reveal branch rows
  await header.click()

  // Endpoint count is shown per branch: "1 ep"
  // Scope to the card to avoid matching other services
  const card = page.locator('div.rounded-xl').filter({ has: page.getByText(SERVICE, { exact: true }) })
  await expect(card.getByText(/\d+\s*ep/i).first()).toBeVisible()
})

test('admin can delete a service from the catalog', async ({ page, request }) => {
  const token = await adminToken(request)
  await uploadSpec(request, token, THROWAWAY, 'main', minimalSpec(THROWAWAY))

  await page.goto('/')
  await expect(page.getByText(THROWAWAY)).toBeVisible({ timeout: 10_000 })

  // Click the delete button on the service card header row.
  // The header row is a div[role="button"] that contains both the service name text
  // and a <button aria-label="Delete service">
  const header = page.locator('[role="button"]').filter({ has: page.getByText(THROWAWAY, { exact: true }) })
  await header.locator('[aria-label="Delete service"]').click()

  // Confirm deletion in dialog
  await page.getByRole('dialog').getByRole('button', { name: /^delete$/i }).click()

  // Service should be removed from the catalog
  await expect(page.getByText(THROWAWAY)).not.toBeVisible({ timeout: 10_000 })
})
