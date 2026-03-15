import { test, expect } from '@playwright/test'

test.describe('Catalog page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('speculo_token', 'mock-jwt-token')
    })
    await page.goto('/')
  })

  test('shows services list', async ({ page }) => {
    await expect(page.getByText('User Service')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'payment-service' })).toBeVisible()
  })

  test('shows branch badges with endpoint counts', async ({ page }) => {
    await expect(page.getByText('12 endpoints')).toBeVisible()
    await expect(page.getByText('8 endpoints')).toBeVisible()
  })

  test('nav links are visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Import' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Tokens' })).toBeVisible()
  })

  test('logout clears token and redirects to login', async ({ page }) => {
    await page.getByRole('button', { name: 'Logout' }).click()
    await expect(page).toHaveURL('/login')
    const token = await page.evaluate(() => localStorage.getItem('speculo_token'))
    expect(token).toBeNull()
  })
})
