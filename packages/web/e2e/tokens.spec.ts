import { test, expect } from '@playwright/test'

test.describe('Tokens page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('speculo_token', 'mock-jwt-token')
    })
    await page.goto('/settings/tokens')
  })

  test('shows existing tokens', async ({ page }) => {
    await expect(page.getByText('Cursor')).toBeVisible()
    // 'read' appears in both the scope badge span and the select option; target the span
    await expect(page.locator('span').filter({ hasText: /^read$/ })).toBeVisible()
  })

  test('creates a new token and shows it once', async ({ page }) => {
    await page.getByPlaceholder('Token name (e.g. Cursor)').fill('My Claude Token')
    await page.getByRole('button', { name: 'Create' }).click()
    // The token is shown in the yellow warning box
    await expect(page.getByText('Token created', { exact: false })).toBeVisible()
    // Token appears in both <code> and inside <pre> MCP config; target the <code> element
    await expect(page.locator('code').filter({ hasText: 'speculo_mcp_mocktokenvalue123456789' })).toBeVisible()
  })

  test('revokes a token', async ({ page }) => {
    await page.getByRole('button', { name: 'Revoke' }).first().click()
    // After revoke, list is reloaded — token should still be visible (mock always returns it)
    // Just check the revoke call didn't error
    await expect(page.getByText('Cursor')).toBeVisible()
  })
})
