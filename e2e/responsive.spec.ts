import { test, expect, type Page } from '@playwright/test'

// Runs on small viewports (360/430) against the seeded emulator data to verify
// the responsive layout: storefront theme, coming-soon, and table->card collapse.
async function noHScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

test('published storefront renders themed and fits viewport', async ({ page }) => {
  await page.goto('/store/beit-el-shay', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-shell')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.store-card').first()).toBeVisible()
  const primary = await page
    .locator('.store-shell')
    .evaluate((el) => getComputedStyle(el as HTMLElement).getPropertyValue('--primary').trim())
  expect(primary).toBe('#16a34a')
  const overflow = await noHScroll(page)
  expect(overflow).toBeLessThan(20)
  await page.screenshot({ path: `e2e/shots/mobile-storefront-${page.viewportSize()!.width}.png` })
})

test('coming-soon page fits viewport with no overflow', async ({ page }) => {
  await page.goto('/store/amal-kids', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-coming-soon')).toBeVisible({ timeout: 15000 })
  const overflow = await noHScroll(page)
  expect(overflow).toBeLessThan(20)
  await page.screenshot({ path: `e2e/shots/mobile-coming-soon-${page.viewportSize()!.width}.png` })
})

test('merchant orders table collapses to cards below 768px', async ({ page }) => {
  await page.goto('/login?role=merchant', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill('owner@a.store')
  await page.locator('input[type="password"]').fill('Owner12345')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto('/dashboard/orders', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.card-table-card').first()).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.table')).toHaveCount(0)
  const overflow = await noHScroll(page)
  expect(overflow).toBeLessThan(20)
  await page.screenshot({ path: `e2e/shots/mobile-orders-${page.viewportSize()!.width}.png` })
})
