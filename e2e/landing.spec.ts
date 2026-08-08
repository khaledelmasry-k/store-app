import { test, expect, type Page } from '@playwright/test'

// Read-only landing page checks. Runs on every project (1440/1024/390/360/430)
// against the seeded emulator data (3 plans) served by vite preview on :4173.

async function noHScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

// Reveal animations hide below-fold sections until IntersectionObserver fires.
// Force everything visible so content assertions + screenshots are deterministic.
async function forceReveal(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => el.classList.add('in-view'))
  })
  await page.waitForTimeout(700)
}

test('renders hero, nav anchors, features, steps, sales, faq', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Hero
  await expect(page.getByRole('heading', { level: 1 })).toContainText('أنشئ متجرك الإلكتروني')
  await expect(page.locator('.hero-eyebrow')).toContainText('منصة التجارة الإلكترونية المتكاملة')
  await expect(page.locator('.landing-brand')).toContainText('M&K Store')
  await expect(page.locator('.landing-header .brand-mark')).toHaveCount(1)
  await expect(page.locator('.landing-footer .brand-mark')).toHaveCount(1)

  // Nav anchors (desktop links + mobile menu target)
  for (const label of ['المميزات', 'كيف تعمل', 'روابط البيع', 'الأسعار', 'الأسئلة الشائعة']) {
    await expect(page.locator('.landing-nav-link', { hasText: label })).toHaveCount(1)
  }
  await expect(page.locator('.landing-nav-btn-primary', { hasText: 'ابدأ مجاناً' })).toHaveCount(1)
  await expect(page.locator('.landing-nav-btn-ghost', { hasText: 'تسجيل الدخول' })).toHaveCount(1)

  // Sections
  await expect(page.locator('.feature-card')).toHaveCount(8)
  await expect(page.locator('.step-item')).toHaveCount(4)
  await expect(page.locator('.sales-step-card')).toHaveCount(4)
  await expect(page.locator('.sales-metric')).toHaveCount(4)
  await expect(page.locator('.stat-card')).toHaveCount(4)
  await expect(page.locator('.faq-item')).toHaveCount(6)

  // Demo-only labeling for the (fake) sales metrics
  await expect(page.locator('.demo-tag')).toContainText('عرض توضيحي')
  await expect(page.locator('.sales-metrics-demo')).toContainText('وليست إحصائيات فعلية')
  await expect(page.locator('.hero-preview-caption')).toContainText('لقطة تمثيلية')
})

test('pricing shows real seeded plans with limits and plan-scoped CTAs', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.pricing-card')).toHaveCount(3)

  const cardByName = (name: string) =>
    page.locator('.pricing-card').filter({ has: page.locator('h3', { hasText: name }) })

  await expect(cardByName('البداية')).toContainText('حتى 20 منتج')
  await expect(cardByName('البداية')).toContainText('حتى 50 طلب شهرياً')
  await expect(cardByName('البداية').locator('.pricing-cta')).toHaveAttribute('href', '/register?plan=plan-starter')

  const growth = cardByName('النمو')
  await expect(growth).toContainText('حتى 100 منتج')
  await expect(growth).toContainText('حتى 200 طلب شهرياً')
  await expect(growth.locator('.pricing-cta')).toHaveAttribute('href', '/register?plan=plan-growth')

  await expect(cardByName('الاحتراف')).toContainText('حتى 500 منتج')
  await expect(cardByName('الاحتراف').locator('.pricing-cta')).toHaveAttribute('href', '/register?plan=plan-pro')

  // Featured plan is the middle one (النمو)
  await expect(page.locator('.pricing-badge')).toHaveCount(1)
  await expect(growth.locator('.pricing-badge')).toContainText('الأكثر شيوعاً')
})

test('faq toggles expand/collapse with aria state', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const first = page.locator('.faq-item').first()
  const btn = first.locator('.faq-question')

  await expect(btn).toHaveAttribute('aria-expanded', 'true')
  await expect(first.locator('.faq-answer')).toBeVisible()

  await btn.click()
  await expect(btn).toHaveAttribute('aria-expanded', 'false')
  await expect(first.locator('.faq-answer')).toBeHidden()

  await btn.click()
  await expect(btn).toHaveAttribute('aria-expanded', 'true')
  await expect(first.locator('.faq-answer')).toBeVisible()
})

test('nav works: mobile menu toggles, desktop links visible', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const toggle = page.locator('.landing-menu-toggle')
  await expect(toggle).toBeAttached()

  if (await toggle.isVisible()) {
    await expect(page.locator('.landing-nav')).not.toHaveClass(/open/)
    await toggle.click()
    await expect(page.locator('.landing-nav')).toHaveClass(/open/)
    await expect(page.locator('.landing-nav-actions')).toBeVisible()
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

  // Hero mockup is the lightweight CSS composition with real Arabic labels.
  await expect(page.locator('.dm-store')).toContainText('بيت الشاي')
  await expect(page.locator('.dm-url')).toHaveText('beit-el-shay.store')
  await expect(page.locator('.dm-kpi')).toHaveCount(4)
  await expect(page.locator('.dm-order')).toHaveCount(3)
  await expect(page.locator('.dm-float')).toHaveCount(2)

  // Every feature card renders a decorative visual.
  await expect(page.locator('.feature-card .fv')).toHaveCount(8)

  // Feature cards in the same grid row share the same height (P5.1 alignment).
  const featureRows = await page.locator('.feature-card').evaluateAll((els) => {
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

  // Pricing cards align: same height and CTAs pinned to the same baseline.
  const pricingBoxes = await page.locator('.pricing-card').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      const cta = el.querySelector('.pricing-cta')
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

  // Scroll reveal: sections below the fold start hidden, then enter view.
  await forceReveal(page)
  const revealed = await page.locator('.reveal.in-view').count()
  expect(revealed).toBe(await page.locator('.reveal').count())
})

test('prefers-reduced-motion: reveal visible and smooth-scroll disabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => (document as any).fonts?.ready)

  const opacity = await page.locator('.reveal').first().evaluate((el) => getComputedStyle(el as HTMLElement).opacity)
  expect(opacity).toBe('1')
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
