import { test, expect, type Page } from '@playwright/test'

async function login(page: Page, role: 'platform' | 'merchant', email: string, password: string) {
  await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/dashboard|\/platform|\/verify-email/, { timeout: 15000 })
}

test('superAdmin can open platform CRM', async ({ page }) => {
  await login(page, 'platform', 'admin@mk.store', 'Admin12345')
  await page.goto('/platform/crm', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'CRM التجار' })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('إجمالي التجار')).toBeVisible()

})
