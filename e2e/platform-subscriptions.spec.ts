import { test, expect, type Page } from '@playwright/test'

async function login(page: Page, role: 'platform' | 'merchant', email: string, password: string) {
  await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/dashboard|\/platform/, { timeout: 15000 })
}

test('platform can open a merchant subscription detail with billing history', async ({ page }) => {
  await login(page, 'platform', 'admin@mk.store', 'Admin12345')
  await page.goto('/platform/subscriptions', { waitUntil: 'domcontentloaded' })
  // The subscriptions list is a shared Table (cardMode): it renders a table on
  // desktop and collapses to cards below 768px. Wait for the actionable rows
  // rather than assuming a desktop-only `<table>` on mobile.
  await page.getByRole('button', { name: 'تفاصيل' }).first().waitFor({ timeout: 20000 })

  // Open the first subscription's detail view.
  await page.getByRole('button', { name: 'تفاصيل' }).first().click()
  await page.waitForURL(/\/platform\/subscriptions\/.+/, { timeout: 15000 })

  // Detail header + recorded billing history should be present.
  await expect(page.getByText('سجل الفوترة')).toBeVisible()
  await expect(page.getByText('التسعير المسجّل')).toBeVisible()
})
