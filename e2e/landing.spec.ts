import { test, expect, type Page } from '@playwright/test'

// Read-only landing page checks. Runs on every project (1440/1024/390/360/430)
// against the seeded emulator data (5 canonical plans) served by vite preview on :4173.

async function noHScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

// Keep screenshot assertions deterministic if a future landing variant reintroduces
// deferred section motion. The current approved composition renders sections directly.
async function forceReveal(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => el.classList.add('in-view'))
  })
  await page.waitForTimeout(700)
}

test('renders hero, nav anchors, features, steps, sales, faq', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Hero
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/ابنِ متجرك\.\s*أدر مبيعاتك\.\s*كبّر تجارتك\./)
  await expect(page.locator('.stitch-release-pill')).toContainText('الإصدار 3.0 متاح الآن')
  await expect(page.locator('.landing-brand')).toContainText('M&K Store')
  await expect(page.locator('.landing-header .brand-mark')).toHaveCount(1)
  await expect(page.locator('.stitch-footer-band .brand-mark')).toHaveCount(1)

  // Nav anchors (desktop links + mobile menu target)
  for (const label of ['المميزات', 'الأسعار', 'حلول الأعمال', 'عن المتجر']) {
    await expect(page.locator('.landing-nav-link', { hasText: label })).toHaveCount(1)
  }
  await expect(page.locator('.landing-nav-btn-primary', { hasText: 'ابدأ الآن مجاناً' })).toHaveCount(1)
  await expect(page.locator('.landing-nav-btn-ghost', { hasText: 'تسجيل الدخول' })).toHaveCount(1)

  // Sections
  await expect(page.locator('.stitch-capability-card')).toHaveCount(4)
  await expect(page.locator('.stitch-rich-overview')).toHaveCount(1)
  await expect(page.locator('.stitch-rich-feature')).toHaveCount(5)
  await expect(page.locator('.rich-workflow-grid > div')).toHaveCount(8)
  await expect(page.locator('.rich-links-preview .rich-link-row')).toHaveCount(4)
  await expect(page.locator('.rich-faq-list details')).toHaveCount(4)
  await expect(page.locator('.rich-storefront-preview')).toBeVisible()
})

test('pricing shows real seeded plans with limits and plan-scoped CTAs', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#pricing')).toBeVisible({ timeout: 15000 })
  // Free + Starter + Growth + Business + Pro — rendered by the shared PricingCard.
  await expect(page.locator('.mk-pricing-card')).toHaveCount(5, { timeout: 15000 })

  // Each plan renders as a `.stitch-plan-wrap` wrapping the PricingCard plus a
  // single plan-scoped link.
  const cardByName = (name: string) =>
    page.locator('.mk-pricing-card').filter({ has: page.locator('.mk-pricing-name', { hasText: name }) })
  const colByName = (name: string) =>
    page.locator('.stitch-plan-wrap').filter({ has: page.locator('.mk-pricing-name', { hasText: name }) })

  // FREE: 50 products and 50 orders/month, free forever.
  await expect(cardByName('FREE')).toContainText('مجاناً')
  await expect(cardByName('FREE')).toContainText('للأبد')
  await expect(cardByName('FREE')).toContainText('حتى 50 منتج')
  await expect(cardByName('FREE')).toContainText('حتى 50 طلب شهرياً')
  await expect(colByName('FREE').locator('.stitch-plan-link')).toHaveAttribute('href', '/register?plan=plan-free')

  // STARTER: 399 EGP, 500 products, 300 orders/month.
  await expect(cardByName('STARTER')).toContainText('399 ج.م')
  await expect(cardByName('STARTER')).toContainText('/ شهريًا')
  await expect(cardByName('STARTER')).toContainText('حتى 500 منتج')
  await expect(cardByName('STARTER')).toContainText('حتى 300 طلب شهرياً')
  await expect(cardByName('STARTER')).toContainText('1 GB تخزين')
  await expect(colByName('STARTER').locator('.stitch-plan-link')).toHaveAttribute('href', '/register?plan=plan-starter')

  // GROWTH (recommended): 749 EGP, 2000 products, 1500 orders/month.
  const growth = cardByName('GROWTH')
  await expect(growth).toContainText('749 ج.م')
  await expect(growth).toContainText('حتى 2000 منتج')
  await expect(growth).toContainText('حتى 1500 طلب شهرياً')
  await expect(growth).toContainText('5 GB تخزين')
  await expect(colByName('GROWTH').locator('.stitch-plan-link')).toHaveAttribute('href', '/register?plan=plan-growth')

  // BUSINESS: 1099 EGP, 5000 products, 3500 orders/month.
  await expect(cardByName('BUSINESS')).toContainText('1,099 ج.م')
  await expect(cardByName('BUSINESS')).toContainText('حتى 5000 منتج')
  await expect(cardByName('BUSINESS')).toContainText('حتى 3500 طلب شهرياً')
  await expect(cardByName('BUSINESS')).toContainText('10 GB تخزين')
  await expect(colByName('BUSINESS').locator('.stitch-plan-link')).toHaveAttribute('href', '/register?plan=plan-business')

  // PRO: 1499 EGP, unlimited products, 10000 orders/month, 20 GB storage.
  await expect(cardByName('PRO')).toContainText('1,499 ج.م')
  await expect(cardByName('PRO')).toContainText('منتجات غير محدودة')
  await expect(cardByName('PRO')).toContainText('حتى 10000 طلب شهرياً')
  await expect(cardByName('PRO')).toContainText('20 GB تخزين')
  await expect(colByName('PRO').locator('.stitch-plan-link')).toHaveAttribute('href', '/register?plan=plan-pro')

  // Each card has exactly ONE primary CTA (no duplicate "ابدأ الآن" buttons).
  await expect(page.locator('.stitch-plan-wrap .stitch-plan-link')).toHaveCount(5)

  // Featured plan is النمو (isPopular), rendered as a single badge.
  await expect(page.locator('.mk-pricing-badge')).toHaveCount(1)
  await expect(growth.locator('.mk-pricing-badge')).toContainText('الأكثر شعبية')
})

test('faq toggles expand/collapse with aria state', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const first = page.locator('.rich-faq-list details').first()
  const btn = first.locator('summary')

  await expect(first).not.toHaveAttribute('open', '')
  await btn.click()
  await expect(first).toHaveAttribute('open', '')
  await expect(first.locator('p')).toBeVisible()

  await btn.click()
  await expect(first).not.toHaveAttribute('open', '')
})

test('nav works: mobile menu toggles, desktop links visible', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const toggle = page.locator('.landing-menu-toggle')
  await expect(toggle).toBeAttached()

  if (await toggle.isVisible()) {
    await expect(page.locator('.landing-nav')).not.toHaveClass(/open/)
    await toggle.click()
    await expect(page.locator('.landing-nav')).toHaveClass(/open/)
    await expect(page.locator('.landing-nav .landing-nav-link')).toHaveCount(4)
    await expect(page.locator('.landing-nav .landing-nav-btn')).toHaveCount(3)
    await toggle.click()
    await expect(page.locator('.landing-nav')).not.toHaveClass(/open/)
  } else {
    await expect(page.locator('.landing-nav-link').first()).toBeVisible()
  }
})

test('no horizontal overflow on the landing page', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const overflow = await noHScroll(page)
  expect(overflow).toBeLessThan(20)
})

test('visual & style sanity: fonts, mockup, equal-height cards, reveal', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => (document as any).fonts?.ready)

  // IBM Plex Sans Arabic actually loads and applies to the page.
  const family = await page.locator('.landing').evaluate((el) => getComputedStyle(el as HTMLElement).fontFamily)
  expect(family).toContain('IBM Plex Sans Arabic')
  expect(await page.evaluate(() => document.fonts.check('700 16px "IBM Plex Sans Arabic"'))).toBe(true)

  // Hero product showcase is a CSS composition and must not leak fake merchant data.
  await expect(page.locator('.stitch-hero-visual')).toBeVisible()
  await expect(page.locator('.stitch-dashboard-tabs span')).toHaveCount(4)
  await expect(page.locator('.stitch-order-float')).toBeVisible()
  await expect(page.locator('.stitch-profit-float')).toBeVisible()
  await expect(page.locator('.landing')).not.toContainText('بيت الشاي')

  // Every feature card renders a decorative visual.
  await expect(page.locator('.stitch-capability-card .stitch-capability-icon')).toHaveCount(4)

  // Feature cards in the same grid row share the same height (P5.1 alignment).
  const featureRows = await page.locator('.stitch-capability-card').evaluateAll((els) => {
    const groups = new Map<number, number[]>()
    for (const el of els) {
      const r = el.getBoundingClientRect()
      const top = Math.round(r.top)
      groups.set(top, [...(groups.get(top) || []), Math.round(r.height)])
    }
    let best: number[] | null = null
    for (const h of groups.values()) if (!best || h.length > best.length) best = h
    return best
  })
  expect(featureRows!.length).toBeGreaterThan(0)
  if (featureRows!.length > 1) {
    expect(Math.max(...featureRows!) - Math.min(...featureRows!)).toBeLessThanOrEqual(1)
  }

  // Pricing columns align: same height and CTAs pinned to the same baseline.
  const pricingBoxes = await page.locator('.stitch-plan-wrap').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      const cta = el.querySelector('.stitch-plan-link')
      const ctaR = cta ? cta.getBoundingClientRect() : null
      return { top: Math.round(r.top), height: Math.round(r.height), ctaBottom: ctaR ? Math.round(ctaR.bottom - r.top) : null }
    }),
  )
  const pTop = pricingBoxes[0].top
  const sameRow = pricingBoxes.filter((b) => b.top === pTop)
  if (sameRow.length > 1) {
    expect(Math.max(...sameRow.map((b) => b.height)) - Math.min(...sameRow.map((b) => b.height))).toBeLessThanOrEqual(1)
    const ctaBottoms = sameRow.map((b) => b.ctaBottom)
    expect(Math.max(...ctaBottoms) - Math.min(...ctaBottoms)).toBeLessThanOrEqual(1)
  }

  // The current approved composition renders rich sections directly.
  await forceReveal(page)
  await expect(page.locator('.stitch-rich-feature').last()).toBeVisible()
})

test('prefers-reduced-motion: reveal visible and smooth-scroll disabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => (document as any).fonts?.ready)

  await expect(page.locator('.stitch-hero')).toBeVisible()
  const scroll = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)
  expect(scroll).toBe('auto')
})

test('auth pages render the split shell with no overflow', async ({ page }) => {
  for (const path of ['/login?role=merchant', '/register', '/forgot-password']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.auth-split')).toBeVisible()
    await expect(page.locator('.auth-panel')).toBeVisible()
    await expect(page.locator('.auth-panel-top')).toContainText('M&K Store')
    await expect(page.locator('.auth-card')).toBeVisible()
    const overflow = await noHScroll(page)
    expect(overflow).toBeLessThan(20)
  }
})

test('captures auth page screenshots at the project viewport', async ({ page }) => {
  const w = page.viewportSize()!.width
  const pages: [string, string][] = [
    ['login', '/login?role=merchant'],
    ['register', '/register'],
    ['forgot', '/forgot-password'],
  ]
  for (const [name, path] of pages) {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await page.screenshot({ path: `e2e/shots/auth-${name}-${w}.png`, fullPage: true })
  }
})

test('captures landing screenshots at the project viewport', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await forceReveal(page)
  const w = page.viewportSize()!.width
  await page.screenshot({ path: `e2e/shots/landing-${w}.png`, fullPage: true })

  // Desktop project also records the 1024 tablet layout.
  if (w >= 1440) {
    await page.setViewportSize({ width: 1024, height: 800 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await forceReveal(page)
    await page.screenshot({ path: 'e2e/shots/landing-1024.png', fullPage: true })
  }
})
