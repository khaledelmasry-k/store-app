import { chromium } from 'playwright'

const merchantRoutes = [
  '/dashboard', '/dashboard/products', '/dashboard/categories', '/dashboard/orders',
  '/dashboard/customers', '/dashboard/coupons', '/dashboard/store-links', '/dashboard/landing-pages',
  '/dashboard/analytics', '/dashboard/settings', '/dashboard/themes', '/dashboard/shipping',
  '/dashboard/team', '/dashboard/subscription', '/dashboard/notifications', '/dashboard/tickets',
]
const platformRoutes = [
  '/platform', '/platform/merchants', '/platform/products', '/platform/orders', '/platform/customers',
  '/platform/subscriptions', '/platform/payments', '/platform/plans', '/platform/reports',
  '/platform/tickets', '/platform/notifications', '/platform/settings', '/platform/audit',
]
const storeRoutes = [
  '/store/test-store-a', '/store/test-store-a/catalog', '/store/test-store-a/cart',
  '/store/test-store-a/checkout', '/store/test-store-a/track', '/store/test-store-a/account',
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const problems = []
const capture = () => {
  problems.length = 0
  page.on('pageerror', (err) => problems.push(`PAGEERROR: ${err.message}`))
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`CONSOLE: ${msg.text().slice(0, 160)}`) })
}
capture()
const login = async (email, pw, url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', pw)
  try { await page.click('button[type="submit"]', { timeout: 8000 }) } catch {}
  await page.waitForTimeout(6000)
}
await login('owner@a.store', 'Owner12345', 'http://localhost:4173/login?role=merchant')
for (const r of merchantRoutes) {
  problems.length = 0
  capture()
  await page.goto(`http://localhost:4173${r}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  const hasBoundary = await page.getByText('حدث خطأ').count()
  const status = problems.length === 0 && hasBoundary === 0 ? 'OK' : `PROBLEM (${problems.length} errs, boundary=${hasBoundary})`
  console.log(`M ${r.padEnd(28)} ${status}`)
  if (problems.length) console.log('   ', problems.slice(0, 2).join(' | '))
}
await login('admin@mk.store', 'Admin12345', 'http://localhost:4173/login?role=platform')
for (const r of platformRoutes) {
  problems.length = 0
  capture()
  await page.goto(`http://localhost:4173${r}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  const hasBoundary = await page.getByText('حدث خطأ').count()
  const status = problems.length === 0 && hasBoundary === 0 ? 'OK' : `PROBLEM (${problems.length} errs, boundary=${hasBoundary})`
  console.log(`P ${r.padEnd(28)} ${status}`)
  if (problems.length) console.log('   ', problems.slice(0, 2).join(' | '))
}
await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' })
for (const r of storeRoutes) {
  problems.length = 0
  capture()
  await page.goto(`http://localhost:4173${r}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const hasBoundary = await page.getByText('حدث خطأ').count()
  const status = problems.length === 0 && hasBoundary === 0 ? 'OK' : `PROBLEM (${problems.length} errs, boundary=${hasBoundary})`
  console.log(`S ${r.padEnd(28)} ${status}`)
  if (problems.length) console.log('   ', problems.slice(0, 2).join(' | '))
}
await browser.close()
