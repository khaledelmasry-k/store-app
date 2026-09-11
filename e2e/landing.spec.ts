import { test, expect, type Page } from '@playwright/test'

// Read-only landing page checks. Runs on every project (1440/1024/390/360/430)
// against the seeded emulator data served by vite preview on :4173.

async function noHScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

async function mockPublicPlatformConfig(page: Page, config: Record<string, unknown>) {
  let calls = 0
  await page.route('**/getPublicPlatformConfig', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    calls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ data: config }),
    })
  })
  return () => calls
}

// Keep screenshot assertions deterministic if a future landing variant reintroduces
// deferred section motion. The current approved composition renders sections directly.
async function forceReveal(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => el.classList.add('in-view'))
  })
  await page.waitForTimeout(700)
}

test('renders the reference-inspired Matjari landing structure', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' })

  // Hero
  await expect(page.getByRole('heading', { level: 1 })).toContainText('شغّل تجارتك')
  await expect(page.locator('.stitch-release-pill')).toContainText('Commerce Operating System')
  await expect(page.locator('.landing-brand .landing-primary-logo')).toHaveCount(1)
  await expect(page.locator('.stitch-footer-band .landing-footer-logo')).toHaveCount(1)

  // Nav anchors (desktop links + mobile menu target)
  for (const label of ['المميزات', 'الحلول', 'الأسعار', 'كيف تعمل', 'الأسئلة الشائعة', 'تواصل معنا']) {
    await expect(page.locator('.landing-nav-link', { hasText: label })).toHaveCount(1)
  }
  await expect(page.locator('.landing-nav-btn-primary', { hasText: 'ابدأ تجربة 3 أيام مجانًا' })).toHaveCount(1)
  await expect(page.locator('.landing-nav-btn-ghost', { hasText: 'تسجيل الدخول' })).toHaveCount(1)

  // Sections
  await expect(page.locator('.stitch-capability-card')).toHaveCount(6)
  await expect(page.locator('.landing-stats .landing-stat')).toHaveCount(4)
  await expect(page.locator('.landing-steps-grid .landing-step')).toHaveCount(3)
  await expect(page.locator('#operating-flow .oj-cards .oj-card')).toHaveCount(6)
  await expect(page.locator('#operating-flow')).toContainText('Store')
  await expect(page.locator('#operating-flow')).toContainText('Reports')
  // The hero now uses the dedicated commerce illustration; the live dashboard
  // mockup remains in the solutions section below.
  await expect(page.locator('.landing-hero-visual')).toHaveCount(1)
  await expect(page.locator('.landing-hero-visual')).toHaveCount(1)
  await expect(page.locator('.rich-faq-list details')).toHaveCount(4)
})

test('pricing shows real seeded plans with limits and plan-scoped CTAs', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' })
  await expect(page.locator('#pricing')).toBeVisible({ timeout: 15000 })
  // Four paid subscriptions are the primary grid. Free and Business stay
  // archived for legacy records and Lifetime remains a separate product.
  await expect(page.locator('.stitch-pricing-grid .mk-pricing-card')).toHaveCount(4, { timeout: 15000 })

  // Each plan renders as a `.stitch-plan-wrap` wrapping the PricingCard plus a
  // single plan-scoped link.
  const cardByName = (name: string) =>
    page.locator('.stitch-pricing-grid .mk-pricing-card').filter({ has: page.locator('.mk-pricing-name', { hasText: name }) })
  const colByName = (name: string) =>
    page.locator('.stitch-plan-wrap').filter({ has: page.locator('.mk-pricing-name', { hasText: name }) })

  await expect(page.locator('.stitch-pricing-grid')).not.toContainText('FREE')
  await expect(page.locator('.stitch-pricing-grid')).not.toContainText('30 يوم')
  await expect(page.locator('.landing')).not.toContainText('first month free')

  // BASIC: 149 EGP, 100 products, 100 orders/month — 3-day trial.
  const basic = cardByName('BASIC')
  await expect(basic).toContainText('149 ج.م')
  await expect(basic).toContainText('حتى 100 منتج')
  await expect(basic).toContainText('حتى 100 طلب شهرياً')
  await expect(basic).toContainText('لمدة 3 أيام')
  await expect(colByName('BASIC').locator('.stitch-plan-link')).toHaveAttribute('href', '/register?plan=plan-basic')
  await expect(colByName('BASIC').locator('.stitch-plan-link')).toContainText('جرّب Basic لمدة 3 أيام')

  // STARTER: 249 EGP, 500 products, 300 orders/month — 3-day trial. أسعار الإطلاق.
  await expect(cardByName('STARTER')).toContainText('249 ج.م')
  await expect(cardByName('STARTER')).toContainText('/ شهريًا')
  await expect(cardByName('STARTER')).toContainText('حتى 500 منتج')
  await expect(cardByName('STARTER')).toContainText('حتى 300 طلب شهرياً')
  await expect(cardByName('STARTER')).toContainText('1 GB تخزين')
  await expect(cardByName('STARTER')).toContainText('لمدة 3 أيام')
  await expect(colByName('STARTER').locator('.stitch-plan-link')).toHaveAttribute('href', '/register?plan=plan-starter')
  await expect(colByName('STARTER').locator('.stitch-plan-link')).toContainText('جرّب Starter لمدة 3 أيام')

  // GROWTH (recommended): 399 EGP, 2000 products, 1500 orders/month — 3-day trial. أسعار الإطلاق.
  const growth = cardByName('GROWTH')
  await expect(growth).toContainText('399 ج.م')
  await expect(growth).toContainText('حتى 2000 منتج')
  await expect(growth).toContainText('حتى 1500 طلب شهرياً')
  await expect(growth).toContainText('5 GB تخزين')
  await expect(growth).toContainText('لمدة 3 أيام')
  await expect(colByName('GROWTH').locator('.stitch-plan-link')).toHaveAttribute('href', '/register?plan=plan-growth')
  await expect(colByName('GROWTH').locator('.stitch-plan-link')).toContainText('جرّب Growth لمدة 3 أيام')

  await expect(cardByName('BUSINESS')).toHaveCount(0)

  // PRO: 649 EGP, unlimited products, 10000 orders/month, 20 GB storage — 3-day trial. أسعار الإطلاق.
  await expect(cardByName('PRO')).toContainText('649 ج.م')
  await expect(cardByName('PRO')).toContainText('منتجات غير محدودة')
  await expect(cardByName('PRO')).toContainText('حتى 10000 طلب شهرياً')
  await expect(cardByName('PRO')).toContainText('20 GB تخزين')
  await expect(cardByName('PRO')).toContainText('لمدة 3 أيام')
  await expect(colByName('PRO').locator('.stitch-plan-link')).toHaveAttribute('href', '/register?plan=plan-pro')
  await expect(colByName('PRO').locator('.stitch-plan-link')).toContainText('جرّب Pro لمدة 3 أيام')

  const lifetime = page.locator('.stitch-lifetime-offer')
  await expect(lifetime).toContainText('امتلك متجرك')
  await expect(lifetime).toContainText(/(?:4,999|٤٬٩٩٩)/)
  await expect(lifetime).toContainText('دفعة واحدة')
  await expect(lifetime).toContainText('حق استخدام دائم')
  await expect(lifetime.locator('a.stitch-offer-cta')).toHaveAttribute('href', '/register?offer=lifetime')
  await expect(lifetime).not.toContainText('لمدة 3 أيام')
  await expect(lifetime).not.toContainText('30 يوم')

  const enterprise = page.locator('.landing-enterprise-offer')
  await expect(enterprise).toContainText('حلول مخصصة')
  await expect(enterprise).toContainText('محتاج متجر أو تشغيل بمواصفات خاصة؟')
  await expect(enterprise).toContainText('تواصل معنا')
  await expect(enterprise).toHaveCount(1)
  await expect(enterprise.locator('a.landing-enterprise-cta')).toHaveAttribute('href', /^https:\/\/wa\.me\//)
  await expect(enterprise.locator('a.landing-enterprise-cta')).toHaveAttribute('target', '_blank')
  await expect(enterprise).not.toContainText('ج.م')
  await expect(page.locator('.stitch-pricing-grid')).not.toContainText('Enterprise')

  // Each card has exactly ONE primary CTA (no duplicate "ابدأ الآن" buttons).
  await expect(page.locator('.stitch-plan-wrap .stitch-plan-link')).toHaveCount(4)

  // Featured plan is النمو (isPopular), rendered as a single badge.
  await expect(page.locator('.mk-pricing-badge')).toHaveCount(1)
  await expect(growth.locator('.mk-pricing-badge')).toContainText('الأكثر طلبًا')
})

test('public config enabled renders one encoded WhatsApp contact flow', async ({ page }) => {
  const message = 'مرحبًا، أريد عرضًا مخصصًا لمتجري'
  const getCalls = await mockPublicPlatformConfig(page, {
    enterpriseWhatsAppNumber: '201001234567',
    enterpriseWhatsAppEnabled: true,
    enterpriseWhatsAppMessage: message,
  })
  await page.goto('/', { waitUntil: 'commit' })

  const expectedHref = `https://wa.me/201001234567?text=${encodeURIComponent(message)}`
  const enterpriseCta = page.locator('.landing-enterprise-offer .landing-enterprise-cta')
  await expect(enterpriseCta).toContainText('اطلب عرضًا مخصصًا')
  await expect(enterpriseCta).toHaveAttribute('href', expectedHref)
  await expect(enterpriseCta).toHaveAttribute('target', '_blank')
  await expect(enterpriseCta).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(page.locator('.landing-footer-whatsapp')).toHaveAttribute('href', expectedHref)
  expect(getCalls()).toBe(1)
})

test('public config disabled falls back to the contact footer without a fake number', async ({ page }) => {
  const getCalls = await mockPublicPlatformConfig(page, {
    enterpriseWhatsAppNumber: '',
    enterpriseWhatsAppEnabled: false,
    enterpriseWhatsAppMessage: 'غير مستخدمة',
  })
  await page.goto('/', { waitUntil: 'commit' })

  const enterpriseCta = page.locator('.landing-enterprise-offer .landing-enterprise-cta')
  await expect(enterpriseCta).toContainText('تواصل معنا')
  await expect(enterpriseCta).toHaveAttribute('href', '#contact')
  await expect(enterpriseCta).not.toHaveAttribute('target', '_blank')
  await expect(page.locator('.landing-footer-whatsapp')).toHaveCount(0)
  await expect(page.locator('.landing-footer-contact-note')).toBeVisible()
  expect(getCalls()).toBe(1)
})

test('registration keeps Lifetime as a dedicated handoff', async ({ page }) => {
  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await page.locator('#reg-name').fill('تاجر اختبار التسعير')
  await page.locator('#reg-phone').fill('01012345678')
  await page.locator('#reg-email').fill('pricing-register@mk.test')
  await page.locator('#reg-password').fill('Launch123')
  await page.getByRole('checkbox', { name: 'أوافق على شروط الاستخدام وسياسة الخصوصية' }).check()
  await page.getByRole('button', { name: 'التالي', exact: true }).click()

  const selected = page.locator('.register-selected-plan-summary')
  await expect(selected).toContainText('BASIC')
  await expect(selected).toContainText(/(?:149|١٤٩)/)
  await expect(selected).toContainText('3 أيام')
  await page.getByRole('button', { name: 'تغيير الباقة', exact: true }).click()

  const cards = page.locator('.register-plan-selector .mk-pricing-card')
  const cardByName = (name: string) => cards.filter({ has: page.locator('.mk-pricing-name', { hasText: new RegExp(`^${name}$`) }) })
  await expect(cards).toHaveCount(4, { timeout: 15000 })
  await expect(cardByName('BASIC')).toContainText(/(?:149|١٤٩)/)
  await expect(cardByName('STARTER')).toContainText(/(?:249|٢٤٩)/)
  await expect(cardByName('GROWTH')).toContainText(/(?:399|٣٩٩)/)
  await expect(cardByName('PRO')).toContainText(/(?:649|٦٤٩)/)
  const selector = page.locator('.register-plan-selector')
  await expect(selector).toContainText('لمدة 3 أيام')
  await expect(selector).not.toContainText('30 يوم')

  await page.goto('/register?offer=lifetime', { waitUntil: 'domcontentloaded' })
  const lifetime = page.getByTestId('lifetime-registration-offer')
  await expect(lifetime).toBeVisible({ timeout: 15000 })
  await expect(lifetime).toContainText('امتلك متجرك')
  await expect(lifetime).toContainText(/(?:4,999|٤٬٩٩٩)/)
  await expect(lifetime).toContainText('دفعة واحدة')
  await expect(lifetime).toContainText('1,000 منتج')
  await expect(page.locator('.register-plan-strip')).toHaveCount(0)
})

test('mobile registration plan selection uses full-width cards without adjacent clipping', async ({ page }) => {
  test.skip((page.viewportSize()?.width || 0) > 640, 'phone layout only')
  const viewportWidth = page.viewportSize()!.width

  for (const planName of ['BASIC', 'STARTER', 'GROWTH', 'PRO']) {
    await page.goto('/register', { waitUntil: 'domcontentloaded' })
    await page.locator('#reg-name').fill(`اختبار ${planName}`)
    await page.locator('#reg-phone').fill('01012345678')
    await page.locator('#reg-email').fill(`pricing-mobile-${planName.toLowerCase()}@mk.test`)
    await page.locator('#reg-password').fill('Pass12345!')
    await page.getByRole('checkbox', { name: 'أوافق على شروط الاستخدام وسياسة الخصوصية' }).check()
    await page.getByRole('button', { name: 'التالي' }).click()

    const selectedSummary = page.locator('.register-selected-plan-summary')
    await expect(selectedSummary).toHaveCount(1)
    await selectedSummary.getByRole('button').click()
    const card = page.locator('.register-plan-selector .mk-pricing-card', {
      has: page.locator('h3.mk-pricing-name', { hasText: new RegExp(`^${planName}$`) }),
    })
    await card.getByRole('button').click()
    await expect(selectedSummary).toContainText(planName)
    const selected = page.locator('.mk-pricing-card--selected')
    await expect(selected).toHaveCount(1)
    await selected.scrollIntoViewIfNeeded()
    const box = await selected.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth)
    await selectedSummary.getByRole('button').click()
    expect(await noHScroll(page)).toBeLessThan(2)
  }
})

test('faq toggles expand/collapse with aria state', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' })
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
  await page.goto('/', { waitUntil: 'commit' })
  const toggle = page.locator('.landing-menu-toggle')
  await expect(toggle).toBeAttached()

  if (await toggle.isVisible()) {
    await expect(page.locator('.landing-nav')).not.toHaveClass(/open/)
    await toggle.click()
    await expect(page.locator('.landing-nav')).toHaveClass(/open/)
    await expect(page.locator('.landing-nav .landing-nav-link')).toHaveCount(6)
    await expect(page.locator('.landing-nav .landing-nav-btn')).toHaveCount(2)
    await toggle.click()
    await expect(page.locator('.landing-nav')).not.toHaveClass(/open/)
  } else {
    await expect(page.locator('.landing-nav-link').first()).toBeVisible()
  }
})

test('no horizontal overflow on the landing page', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' })
  const overflow = await noHScroll(page)
  expect(overflow).toBeLessThan(20)
})

test('visual & style sanity: fonts, mockup, equal-height cards, reveal', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' })
  await page.evaluate(() => (document as any).fonts?.ready)

  // Cairo is the single Arabic-first family used across the application.
  const family = await page.locator('.landing').evaluate((el) => getComputedStyle(el as HTMLElement).fontFamily)
  expect(family).toContain('Cairo')

  // Hero product showcase is a CSS composition and must not leak real merchant data.
  await expect(page.locator('.landing-hero-visual').first()).toBeVisible()
  await expect(page.locator('.landing-hero-visual img')).toHaveCount(1)
  await expect(page.locator('.landing')).not.toContainText('بيت الشاي')

  // Every feature card renders a decorative visual.
  await expect(page.locator('.stitch-capability-card .stitch-capability-icon')).toHaveCount(6)

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

  await expect(page.locator('.landing-final-cta')).toBeVisible()
})

test('prefers-reduced-motion: reveal visible and smooth-scroll disabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/', { waitUntil: 'commit' })
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
    await expect(page.locator('.auth-panel-top .auth-panel-logo')).toHaveAttribute('aria-label', /Matjari/)
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
  await page.goto('/', { waitUntil: 'commit' })
  await forceReveal(page)
  const w = page.viewportSize()!.width
  await page.screenshot({ path: `e2e/shots/landing-${w}.png`, fullPage: true })

  // Desktop project also records the 1024 tablet layout.
  if (w >= 1440) {
    await page.setViewportSize({ width: 1024, height: 800 })
    await page.goto('/', { waitUntil: 'commit' })
    await forceReveal(page)
    await page.screenshot({ path: 'e2e/shots/landing-1024.png', fullPage: true })
  }
})
