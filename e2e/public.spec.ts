import { test, expect } from '@playwright/test'

test('login renders auth card with brand', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await expect(page.locator('.auth-screen')).toBeVisible()
  await expect(page.locator('.auth-brand')).toBeVisible()
  await expect(page.locator('.auth-card input[type="email"]')).toBeVisible()
  await expect(page.locator('.auth-card button[type="submit"]')).toContainText('تسجيل الدخول')
})

test('register renders stepper and plan cards', async ({ page }) => {
  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await expect(page.locator('.auth-stepper')).toBeVisible()
  await expect(page.locator('.auth-step')).toHaveCount(4)
  const step1 = page.locator('.auth-step').first()
  await expect(step1.locator('.auth-step-dot--active')).toBeVisible()
  await expect(page.locator('.auth-card input')).toHaveCount(3)
})
