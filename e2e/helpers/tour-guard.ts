import { expect, type Locator, type Page } from '@playwright/test'

export async function dismissMerchantTourIfVisible(page: Page) {
  const overlay = page.locator('.merchant-tour-overlay:visible').first()
  if (await overlay.count() === 0) return
  const neverAgain = overlay.getByRole('checkbox', { name: /لا تعرض هذا الدليل مرة أخرى/ }).first()
  if (await neverAgain.count() && !(await neverAgain.isChecked().catch(() => false))) {
    await neverAgain.check({ force: true })
  }
  const dismiss = overlay.getByRole('button', { name: /فهمت، أكمل للوحة|تخطي الجولة/ }).first()
  if (await dismiss.count()) {
    // The tour scrolls its target into view, so the overlay can still be
    // settling when the button is found. An unbounded click waits for it to be
    // "stable" until the whole test times out — 90s spent on a dismissal.
    // Bound each try instead, and fall back to a forced click: the goal here is
    // only to get the overlay out of the way, not to assert its hit target.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await dismiss.click({ timeout: 2000 })
        break
      } catch (error) {
        if (attempt < 2) continue
        await dismiss.click({ force: true, timeout: 2000 }).catch(() => { throw error })
      }
    }
  }
  await expect(page.locator('.merchant-tour-overlay:visible')).toHaveCount(0, { timeout: 5000 })
}

export async function safeClickWithTourGuard(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await dismissMerchantTourIfVisible(page)
    await expect(target).toBeVisible({ timeout: 5000 })
    await expect(target).toBeEnabled({ timeout: 5000 })
    await dismissMerchantTourIfVisible(page)
    try {
      await target.click({ timeout: 1500 })
      return
    } catch (error) {
      if (attempt === 2) throw error
      await dismissMerchantTourIfVisible(page)
    }
  }
}
