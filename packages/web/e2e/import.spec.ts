import { test, expect } from '@playwright/test'

test.describe('Import page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('speculo_token', 'mock-jwt-token')
    })
    await page.goto('/import')
  })

  test('shows upload form', async ({ page }) => {
    // Labels are not associated via htmlFor — use text locators
    await expect(page.getByText('Service name')).toBeVisible()
    await expect(page.getByText('Branch')).toBeVisible()
    await expect(page.getByText('Drop openapi.yaml', { exact: false })).toBeVisible()
  })

  test('shows success after uploading a file', async ({ page }) => {
    // Fill in the service name input (first text input in the form)
    await page.locator('input[placeholder="user-service"]').fill('test-service')

    // Create a minimal OpenAPI file buffer and upload it
    const fileContent = JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {},
    })

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByText('Drop openapi.yaml', { exact: false }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: 'openapi.json',
      mimeType: 'application/json',
      buffer: Buffer.from(fileContent),
    })

    await page.getByRole('button', { name: 'Upload' }).click()
    // Result text: "✓ Uploaded — 5 endpoints"
    await expect(page.getByText('5 endpoints', { exact: false })).toBeVisible()
  })

  test('cancel navigates back to catalog', async ({ page }) => {
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL('/')
  })
})
