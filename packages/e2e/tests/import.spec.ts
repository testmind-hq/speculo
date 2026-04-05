/**
 * S3 — Import (spec upload)
 * Runs in the `admin` project.
 */
import { test, expect } from '@playwright/test'
import { adminToken, deleteService, minimalSpec } from './helpers.js'

const RUN = Date.now()
const SERVICE_UPLOAD = `e2e-upload-${RUN}`
const SERVICE_CATALOG = `e2e-catalog-check-${RUN}`

test.afterAll(async ({ request }) => {
  const token = await adminToken(request)
  await deleteService(request, token, SERVICE_UPLOAD)
  await deleteService(request, token, SERVICE_CATALOG)
})

test('upload valid OpenAPI 3.1 YAML shows success with endpoint count', async ({ page }) => {
  await page.goto('/import')
  await page.fill('#service', SERVICE_UPLOAD)
  await page.fill('#branch', 'main')

  await page.getByTestId('spec-file-input').setInputFiles({
    name: `${SERVICE_UPLOAD}.yaml`,
    mimeType: 'application/x-yaml',
    buffer: Buffer.from(minimalSpec(SERVICE_UPLOAD)),
  })

  await page.click('button[type=submit]')

  // Success alert contains endpoint count
  const alert = page.getByTestId('upload-success-alert')
  await expect(alert).toBeVisible({ timeout: 10_000 })
  await expect(alert).toContainText('2')
})

test('submit without a file shows error', async ({ page }) => {
  await page.goto('/import')
  await page.fill('#service', 'test-no-file')
  await page.fill('#branch', 'main')
  // Deliberately skip file attachment
  await page.click('button[type=submit]')
  await expect(page.getByTestId('upload-error-alert')).toBeVisible({ timeout: 5_000 })
})

test('uploaded service appears in catalog', async ({ page, request }) => {
  const token = await adminToken(request)
  await request.fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      service: SERVICE_CATALOG,
      branch: 'main',
      file: {
        name: 'spec.yaml',
        mimeType: 'application/x-yaml',
        buffer: Buffer.from(minimalSpec(SERVICE_CATALOG)),
      },
    },
  })

  await page.goto('/')
  await expect(page.getByText(SERVICE_CATALOG)).toBeVisible({ timeout: 10_000 })
})
