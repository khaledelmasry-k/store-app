import { test, expect, type Page } from '@playwright/test'

const viewports = [
  [1440, 900], [1366, 768], [1024, 768], [820, 1180],
  [768, 1024], [430, 932], [390, 844], [360, 800],
] as const

const routes = {
  platform: ['/platform', '/platform/merchants', '/platform/orders', '/platform/coupons', '/platform/plans', '/platform/shipping-companies'],
  merchant: ['/dashboard', '/dashboard/products', '/dashboard/orders'],
} as const

async function login(page: Page, role: 'platform' | 'merchant') {
  const credentials = role === 'platform'
    ? ['khaaledelmasry@gmail.com', 'Admin12345']
    : ['owner@a.store', 'Owner12345']
  await page.goto(`http://localhost:4173/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(credentials[0])
  await page.locator('input[type="password"]').fill(credentials[1])
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(role === 'platform' ? /\/platform/ : /\/dashboard/)
  await expect(page.locator('.console-shell')).toBeVisible()
}

test('authenticated console shell responsive contract', async ({ browser }) => {
  for (const [width, height] of viewports) {
    for (const role of ['platform', 'merchant'] as const) {
      const context = await browser.newContext({ viewport: { width, height } })
      const page = await context.newPage()
      await login(page, role)
      for (const route of routes[role]) {
        await page.goto(`http://localhost:4173${route}`, { waitUntil: 'domcontentloaded' })
        await expect(page.locator('.console-shell')).toBeVisible()
        const metrics = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth
          const offenders = Array.from(document.querySelectorAll('*')).map((el) => {
            const r = el.getBoundingClientRect()
            const style = getComputedStyle(el)
            let scrollContainer: HTMLElement | null = el.parentElement
            let internalScroll = false
            while (scrollContainer) {
              const ancestorStyle = getComputedStyle(scrollContainer)
              if (['auto', 'scroll'].includes(ancestorStyle.overflowX)) { internalScroll = true; break }
              scrollContainer = scrollContainer.parentElement
            }
            return { tag: el.tagName, className: String(el.className || ''), left: r.left, right: r.right, width: r.width, scrollWidth: el.scrollWidth, position: style.position, display: style.display, visibility: style.visibility, opacity: style.opacity, internalScroll }
          }).filter((x) => (x.right > vw + 1 || x.left < -1) && x.position !== 'fixed' && x.display !== 'none' && x.visibility !== 'hidden' && Number(x.opacity) > 0 && !x.internalScroll)
          const segmented = document.querySelector('.segmented')
          const parent = segmented?.parentElement
          const rect = segmented?.getBoundingClientRect()
          return {
            innerWidth: window.innerWidth,
            clientWidth: vw,
            documentScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            offenders,
            rail: !!document.querySelector('.console-sidebar') && getComputedStyle(document.querySelector('.console-sidebar')!).display !== 'none',
            bottomNav: !!document.querySelector('.console-mobile-nav') && getComputedStyle(document.querySelector('.console-mobile-nav')!).display !== 'none',
            more: !!document.querySelector('.console-mobile-nav button'),
            segmentedWidth: rect ? Math.round(rect.width) : null,
            segmentedContainerWidth: parent ? Math.round(parent.getBoundingClientRect().width) : null,
            segmentedContainerScrollWidth: parent?.scrollWidth ?? null,
          }
        })
        expect(Math.abs(metrics.documentScrollWidth - metrics.clientWidth), `${role} ${route} ${width}`).toBeLessThanOrEqual(1)
        expect(metrics.offenders, `${role} ${route} ${width} overflow`).toEqual([])
        if (width <= 1024) {
          expect(metrics.rail).toBe(false)
          expect(metrics.bottomNav).toBe(true)
          expect(metrics.more).toBe(true)
        }
        if (role === 'platform' && route === '/platform' && [1440, 1024, 768, 430, 390, 360].includes(width)) {
          await page.screenshot({ path: `/tmp/admin-shell-platform-${width}.png`, fullPage: false })
        }
        if (role === 'merchant' && route === '/dashboard' && [1440, 390, 360].includes(width)) {
          await page.screenshot({ path: `/tmp/admin-shell-merchant-${width}.png`, fullPage: false })
        }
      }
      await context.close()
    }
  }
})
