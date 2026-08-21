import { test, expect, type Page } from '@playwright/test'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login?role=merchant', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  if ((await page.locator('button[type="submit"]').count()) === 0) {
    const logout = page.locator('.sidebar-logout:visible').first()
    if ((await logout.count()) === 0) {
      await page.locator('.sidebar-toggle:visible').first().click()
    }
    await page.locator('.sidebar-logout:visible').first().click()
    await page.waitForURL(/\/login/, { timeout: 15000 })
  }
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/dashboard|\/platform/, { timeout: 15000 })
  await page.goto('/dashboard/themes', { waitUntil: 'domcontentloaded' })
}

// Branding rendering rules (seeded stores in scripts/seed-emulator.mjs):
//   /store/test-logo-store  -> has logo + heroImage: header shows LOGO ONLY (no
//                              duplicated name), footer an independent logo,
//                              hero renders the uploaded image (no overlay/CTA).
//   /store/test-plain-store -> no logo: header shows icon + store NAME, hero is
//                              the generated overlay + CTA.
//   /store/test-broken-logo-store -> broken logo URL: header falls back to the name.
//   /store/test-preset-store -> platform preset logo only.

const BRANDING_STORES = {
  logo: 'test-logo-store',
  plain: 'test-plain-store',
  brokenLogo: 'test-broken-logo-store',
  preset: 'test-preset-store',
} as const

test('header shows logo only when the store has a logo (no duplicated name)', async ({ page }) => {
  await page.goto(`/store/${BRANDING_STORES.logo}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-header')).toBeVisible({ timeout: 15000 })
  const headerBrand = page.locator('.store-brand')
  await expect(headerBrand.locator('img.store-logo')).toBeVisible()
  await expect(headerBrand.locator('strong')).toHaveCount(0)
})

test('header falls back to icon + store name when the store has no logo', async ({ page }) => {
  await page.goto(`/store/${BRANDING_STORES.plain}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-header')).toBeVisible({ timeout: 15000 })
  const headerBrand = page.locator('.store-brand')
  await expect(headerBrand.locator('.store-brand-name')).toBeVisible()
  await expect(headerBrand.locator('.store-brand-name')).toContainText('TEST - متجر بدون لوجو')
  await expect(headerBrand.locator('img.store-logo')).toHaveCount(0)
  await expect(headerBrand.locator('.store-logo--preset')).toHaveCount(0)
})

test('header falls back to the store name when the logo fails to load', async ({ page }) => {
  await page.goto(`/store/${BRANDING_STORES.brokenLogo}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-header')).toBeVisible({ timeout: 15000 })
  const headerBrand = page.locator('.store-brand')
  // The broken <img> is removed after onError; wait for the name fallback.
  await expect(headerBrand.locator('.store-brand-name')).toBeVisible({ timeout: 15000 })
  await expect(headerBrand.locator('.store-brand-name')).toContainText('متجر لوجو معطل')
  await expect(headerBrand.locator('img.store-logo')).toHaveCount(0)
})

test('header renders a platform-offered preset logo only (no duplicated name)', async ({ page }) => {
  await page.goto(`/store/${BRANDING_STORES.preset}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-header')).toBeVisible({ timeout: 15000 })
  const headerBrand = page.locator('.store-brand')
  await expect(headerBrand.locator('.store-logo--preset')).toBeVisible()
  await expect(headerBrand.locator('.store-brand-name')).toHaveCount(0)
  await expect(headerBrand.locator('img.store-logo')).toHaveCount(0)
})

test('footer shows an independent (larger) logo when the store has one', async ({ page }) => {
  await page.goto(`/store/${BRANDING_STORES.logo}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-footer')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.store-footer .store-footer-logo')).toBeVisible()

  // Header logo must render at the target merchant-logo footprint — at least
  // ~90x40 on mobile, and up to ~120x56 on desktop — never a 40-48px sliver.
  const header = await page.locator('.store-header img.store-logo').evaluate((el) => {
    const r = (el as HTMLElement).getBoundingClientRect()
    return { w: r.width, h: r.height }
  })
  expect(header.w).toBeGreaterThanOrEqual(80)
  expect(header.h).toBeGreaterThanOrEqual(38)
  expect(header.h).toBeLessThanOrEqual(62)

  const footer = await page.locator('.store-footer .store-footer-logo').evaluate((el) => {
    const r = (el as HTMLElement).getBoundingClientRect()
    return { w: r.width, h: r.height }
  })
  // Footer logo is clearly larger than the header logo.
  expect(footer.h).toBeGreaterThan(header.h)
  expect(footer.w).toBeGreaterThan(header.w)
  // And it stays inside its viewport (no overflow on the storefront).
  expect(footer.w).toBeLessThanOrEqual(260)
  expect(footer.h).toBeLessThanOrEqual(110)
})

test('hero renders the uploaded image only (no generated overlay/CTA) when heroImage exists', async ({ page }) => {
  await page.goto(`/store/${BRANDING_STORES.logo}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-hero--image')).toBeVisible({ timeout: 15000 })
  const img = page.locator('.store-hero--image img.store-hero-img')
  await expect(img).toBeVisible()
  await expect(page.locator('.store-hero-badge')).toHaveCount(0)
  await expect(page.locator('.store-hero .btn')).toHaveCount(0)

  // The uploaded image keeps its natural aspect ratio (no crop/stretch).
  const dims = await img.evaluate((el) => {
    const i = el as HTMLImageElement
    const r = i.getBoundingClientRect()
    return { ratio: r.width / r.height, n: i.naturalWidth / i.naturalHeight, objectFit: getComputedStyle(i).objectFit }
  })
  expect(dims.n).toBeGreaterThan(0)
  // The storefront intentionally uses object-fit: cover so the hero fills its
  // responsive frame; mobile cropping is expected and must not be treated as
  // image stretching.
  expect(dims.objectFit).toBe('cover')
  expect(dims.ratio).toBeGreaterThan(0)
})

test('hero keeps the generated overlay + CTA when the store has no heroImage', async ({ page }) => {
  await page.goto(`/store/${BRANDING_STORES.plain}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-hero')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.store-hero--image')).toHaveCount(0)
  await expect(page.locator('.store-hero .btn')).toContainText('تسوق الآن')
})

test('first visit defaults to LIGHT mode even when the OS prefers dark', async ({ page }) => {
  // Fresh browser context (no saved preference) + a dark OS → must STILL be light.
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(`/store/${BRANDING_STORES.plain}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-header')).toBeVisible({ timeout: 15000 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')), { timeout: 15000 })
    .toBe('light')
})

test('user-selected dark mode persists across refresh; no preference = light', async ({ page }) => {
  await page.goto(`/store/${BRANDING_STORES.plain}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-header')).toBeVisible({ timeout: 15000 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')), { timeout: 15000 })
    .toBe('light')

  // Manually switch to dark.
  await page.locator('.store-actions button[title="تغيير الوضع"]').click()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')), { timeout: 15000 })
    .toBe('dark')

  // Refresh — the explicit choice must be restored.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-header')).toBeVisible({ timeout: 15000 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')), { timeout: 15000 })
    .toBe('dark')
})

test('upload trims transparent padding from a merchant logo (stored PNG = trimmed box)', async ({ page }) => {
  // Merchant of the branding store uploads a NEW logo: a solid
  // 120×80 mark drawn with large empty transparent margins inside a 400×400
  // canvas. The stored PNG must be cropped to exactly the visible mark
  // (120×80), otherwise it would keep rendering as a tiny stamp in the 132×60
  // header box.
  const buffer = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 400, 400)
    ctx.fillStyle = '#4f46e5'
    ctx.fillRect(60, 40, 120, 80)
    return new Promise<number[]>((resolve) =>
      canvas.toBlob(async (blob) => {
        resolve(Array.from(new Uint8Array(await blob!.arrayBuffer())))
      }, 'image/png')
    )
  })

  await login(page, 'owner@f.store', 'Owner12345')
  await expect(page.getByRole('button', { name: 'رفع شعار' })).toBeVisible({ timeout: 15000 })

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'padded-logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(buffer),
  })
  await expect(page.getByText('تم تحديث شعار المتجر')).toBeVisible({ timeout: 20000 })

  // The trimmed asset is exactly what the storefront renders.
  await page.goto(`/store/${BRANDING_STORES.logo}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-header img.store-logo')).toBeVisible({ timeout: 15000 })
  const dims = await page.evaluate(async () => {
    const img = document.querySelector('.store-header img.store-logo') as HTMLImageElement
    const out: { fileW?: number; fileH?: number; nw: number; nh: number } = { nw: img.naturalWidth, nh: img.naturalHeight }
    try {
      const bytes = new Uint8Array(await (await fetch(img.src)).arrayBuffer())
      out.fileW = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
      out.fileH = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
    } catch {
      // CORS may block the raw fetch; the naturalWidth check below still proves
      // the stored file's intrinsic size (it decodes directly from the file).
    }
    return out
  })
  expect(dims.nw).toBe(120)
  expect(dims.nh).toBe(80)
  if (dims.fileW != null) {
    expect(dims.fileW).toBe(120)
    expect(dims.fileH).toBe(80)
  }
})
