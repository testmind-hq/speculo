/**
 * S1 — Authentication
 * Runs in the `anon` project (no stored session).
 */
import { test, expect } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers.js'

test('login page renders with email + password fields', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('#email')).toBeVisible()
  await expect(page.locator('#password')).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
})

test('unauthenticated access to / redirects to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('invalid credentials shows error message', async ({ page }) => {
  await page.goto('/login')
  await page.fill('#email', 'nobody@example.com')
  await page.fill('#password', 'wrongpassword')
  await page.click('button[type=submit]')
  await expect(page.locator('.text-destructive')).toBeVisible()
})

test('valid admin login navigates to catalog', async ({ page }) => {
  await page.goto('/login')
  await page.fill('#email', ADMIN_EMAIL)
  await page.fill('#password', ADMIN_PASSWORD)
  await page.click('button[type=submit]')
  await expect(page).toHaveURL('/')
})
