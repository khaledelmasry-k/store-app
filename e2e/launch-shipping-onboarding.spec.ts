import { test, expect } from '@playwright/test'

test('shipping onboarding checklist renders without horizontal overflow', async ({ page }) => {
  await page.goto('/dashboard')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})
