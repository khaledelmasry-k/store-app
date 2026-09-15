import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { authenticateMerchant } from './helpers/emulator-browser-auth'

const evidence = 'artifacts/phase2-shipping-visual'
const viewports = [[360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900]] as const
const merchantRoutes = [['shipping', '/dashboard/shipping'], ['dashboard', '/dashboard'], ['orders', '/dashboard/orders']] as const

async function capture(page: import('@playwright/test').Page, name: string, theme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: theme })
  await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
  await page.waitForTimeout(250)
  const state = await page.evaluate(() => ({ dir: document.documentElement.dir, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 }))
  expect(state.dir).toBe('rtl')
  expect(state.overflow).toBe(false)
  mkdirSync(evidence, { recursive: true })
  await page.screenshot({ path: `${evidence}/${name}-${theme}.png`, fullPage: true })
}

test('phase 2 shipping visual QA uses canonical merchant emulator auth', async ({ browser }) => {
  test.setTimeout(180000)
  for (const [width, height] of viewports) {
    const merchant = await browser.newContext({ viewport: { width, height } })
    const page = await merchant.newPage()
    await authenticateMerchant(page)
    await expect(page.locator('.app-shell--dashboard')).toBeVisible()
    for (const [name, route] of merchantRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await capture(page, `${name}-${width}`, 'light')
    }
    const detailsHref = await page.locator('a[href*="/dashboard/orders/"]').first().getAttribute('href').catch(() => null)
    if (detailsHref) { await page.goto(detailsHref, { waitUntil: 'domcontentloaded' }); await capture(page, `order-details-${width}`, 'light') }
    await merchant.close()
  }
  for (const [width, height] of [[390, 844], [1024, 768]] as const) {
    const merchant = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' })
    const page = await merchant.newPage()
    await authenticateMerchant(page)
    for (const [name, route] of merchantRoutes) { await page.goto(route, { waitUntil: 'domcontentloaded' }); await capture(page, `${name}-${width}`, 'dark') }
    await merchant.close()
  }
  for (const [width, height] of [[768, 1024], [1024, 768], [1440, 900], [390, 844]] as const) {
    const storefront = await browser.newContext({ viewport: { width, height } })
    const page = await storefront.newPage()
    await page.goto('/store/test-store-a/checkout', { waitUntil: 'domcontentloaded' })
    await capture(page, `checkout-${width}`, width === 390 ? 'dark' : 'light')
    await storefront.close()
  }
})
