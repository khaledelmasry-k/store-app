import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dismissMerchantTourIfVisible } from './helpers/tour-guard'

const themeModes = ['light', 'dark'] as const
const shot = async (page: Page, theme: string, name: string) => {
  await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' })
  await page.evaluate((mode) => document.documentElement.dataset.theme = mode, theme)
  await page.waitForTimeout(250)
  const width = page.viewportSize()?.width || 0
  const dir = `artifacts/ui-visual/${theme}/${width}`
  mkdirSync(dir, { recursive: true })
  const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true })
  if (overflow.scrollWidth > overflow.clientWidth) {
    const offender = await page.evaluate(() => {
      const all = [...document.querySelectorAll<HTMLElement>('*')]
      return all.find((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)?.className || 'unknown'
    })
    console.warn(`OVERFLOW ${name} ${width}: ${overflow.scrollWidth}/${overflow.clientWidth} ${offender}`)
  }
}

async function capture(page: Page, route: string, name: string, themes = themeModes) {
  await page.goto(route, { waitUntil: 'commit', timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)
  for (const theme of themes) await shot(page, theme, name)
}

async function loginAs(page: Page, role: 'merchant' | 'platform') {
  await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(role === 'merchant' ? 'owner@a.store' : 'khaaledelmasry@gmail.com')
  await page.locator('input[type="password"]').fill(role === 'merchant' ? 'Owner12345' : 'Admin12345')
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click()
  await page.waitForURL(role === 'merchant' ? /\/dashboard/ : /\/platform/, { timeout: 20000 })
  if (role === 'merchant') await dismissMerchantTourIfVisible(page)
}

test('public and storefront visual matrix', async ({ page }) => {
  for (const [route, name] of [['/', 'landing'], ['/login', 'login'], ['/register', 'register'], ['/store/test-store-a', 'storefront'], ['/store/test-store-a/cart', 'cart'], ['/store/test-store-a/checkout', 'checkout']]) {
    await capture(page, route, name)
  }
})

test('merchant visual matrix', async ({ page }) => {
  await loginAs(page, 'merchant')
  const routes: [string, string][] = [
    ['/dashboard', 'merchant-dashboard'], ['/dashboard/products', 'merchant-products'], ['/dashboard/orders', 'merchant-orders'],
    ['/dashboard/orders/qa-order', 'merchant-order-details'], ['/dashboard/customers', 'merchant-customers'], ['/dashboard/shipping', 'merchant-shipping'],
    ['/dashboard/subscription', 'merchant-subscription'], ['/dashboard/settings', 'merchant-settings'], ['/dashboard/themes', 'merchant-themes'],
    ['/dashboard/store-links', 'merchant-store-links'], ['/dashboard/landing-pages', 'merchant-landing-pages'], ['/dashboard/analytics', 'merchant-analytics'], ['/dashboard/team', 'merchant-team'],
  ]
  for (const [route, name] of routes) await capture(page, route, name, ['light', 'dark'])
})

test('superadmin visual matrix', async ({ page }) => {
  await loginAs(page, 'platform')
  const routes: [string, string][] = [
    ['/platform', 'platform-dashboard'], ['/platform/merchants', 'platform-merchants'], ['/platform/crm', 'platform-crm'],
    ['/platform/subscriptions', 'platform-subscriptions'], ['/platform/plans', 'platform-plans'], ['/platform/payments', 'platform-payments'],
    ['/platform/coupons', 'platform-coupons'], ['/platform/analytics', 'platform-analytics'], ['/platform/audit', 'platform-audit'],
    ['/platform/notifications', 'platform-notifications'], ['/platform/tickets', 'platform-tickets'], ['/platform/settings', 'platform-settings'],
    ['/platform/shipping-companies', 'platform-shipping-companies'], ['/platform/shipping-companies/qa-partner-1', 'platform-provider-details'], ['/platform/shipping-revenue', 'platform-shipping-revenue'],
  ]
  for (const [route, name] of routes) await capture(page, route, name, ['light', 'dark'])
})
