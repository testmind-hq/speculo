/**
 * Playwright setup project — runs once before all test projects.
 * Creates two auth state files:
 *   playwright/.auth/admin.json  — super_admin session
 *   playwright/.auth/user.json   — regular guest user session
 */
import { test as setup, expect } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, TEST_USER_EMAIL, TEST_USER_PASSWORD } from './helpers.js'

const ADMIN_FILE = 'playwright/.auth/admin.json'
const USER_FILE = 'playwright/.auth/user.json'

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login')
  await page.fill('#email', ADMIN_EMAIL)
  await page.fill('#password', ADMIN_PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL('/', { timeout: 15_000 }).catch(async () => {
    const errorText = await page.locator('.text-destructive').textContent().catch(() => 'unknown error')
    throw new Error(
      `Admin login failed: "${errorText}". ` +
      `Check ADMIN_EMAIL (${ADMIN_EMAIL}) and ADMIN_PASSWORD env vars.`
    )
  })
  await page.context().storageState({ path: ADMIN_FILE })
})

setup('create and authenticate test user', async ({ page, request }) => {
  // Get an admin token via the API to create the test user
  const loginRes = await request.post('/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  expect(loginRes.ok()).toBeTruthy()
  const { token } = await loginRes.json() as { token: string }

  // Create test user — ignore 409 (already exists from a previous run)
  const createRes = await request.post('/auth/register', {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!createRes.ok() && createRes.status() !== 409) {
    throw new Error(`Could not create test user: ${await createRes.text()}`)
  }

  // Login as test user via UI and save session
  await page.goto('/login')
  await page.fill('#email', TEST_USER_EMAIL)
  await page.fill('#password', TEST_USER_PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL('/', { timeout: 15_000 }).catch(async () => {
    const errorText = await page.locator('.text-destructive').textContent().catch(() => 'unknown error')
    throw new Error(
      `Test user login failed: "${errorText}". ` +
      `Check TEST_USER_EMAIL (${TEST_USER_EMAIL}) and TEST_USER_PASSWORD env vars.`
    )
  })
  await page.context().storageState({ path: USER_FILE })
})
