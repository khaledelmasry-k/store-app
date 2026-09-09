import { test, expect } from '@playwright/test'
import { authenticateSuperAdmin } from './helpers/emulator-browser-auth'

test('impersonation authorization matrix is represented by platform route', async ({ page }) => {
  await authenticateSuperAdmin(page)
  await page.goto('/platform', { waitUntil: 'domcontentloaded' })
  expect(page.url()).toContain('/platform')
  await expect(page.locator('.app-shell--platform')).toBeVisible()
})
