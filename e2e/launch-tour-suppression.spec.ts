import { test, expect } from '@playwright/test'

test('completed merchant profile suppresses welcome tour surface', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('[role="dialog"]').filter({ hasText: /جولة|مرحبًا|ابدأ/ })).toHaveCount(0)
})
