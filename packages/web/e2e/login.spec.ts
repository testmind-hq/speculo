import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('shows login form', async ({ page }) => {
    // Labels are not associated via htmlFor — use type selectors
    await expect(page.locator('[type=email]')).toBeVisible()
    await expect(page.locator('[type=password]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.locator('[type=email]').fill('wrong@example.com')
    await page.locator('[type=password]').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Invalid credentials')).toBeVisible()
  })

  test('redirects to catalog on successful login', async ({ page }) => {
    await page.locator('[type=email]').fill('admin@example.com')
    await page.locator('[type=password]').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Services')).toBeVisible()
  })

  test('unauthenticated visit to / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/login')
  })
})
