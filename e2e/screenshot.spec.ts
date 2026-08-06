import { test, expect } from '@playwright/test'

const PUBLIC_ROUTES = [
  { path: '/', name: 'platform-landing' },
  { path: '/login', name: 'login' },
  { path: '/register', name: 'register' },
  { path: '/forgot-password', name: 'forgot-password' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
  { path: '/contact', name: 'contact' },
]

for (const route of PUBLIC_ROUTES) {
  test(`screenshot ${route.name}`, async ({ page }, testInfo) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await page.screenshot({
      path: `e2e/shots/${testInfo.project.name}/${route.name}.png`,
      fullPage: true,
    })
    expect(await page.title()).toBeTruthy()
  })
}
