import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`))
await page.goto('http://127.0.0.1:4173/dashboard/login', { waitUntil: 'domcontentloaded' })
await page.fill('input[type="email"]', 'owner@a.store')
await page.fill('input[type="password"]', 'Owner12345')
await page.click('button[type="submit"]')
await page.waitForURL('**/dashboard/**', { timeout: 15000 })
await page.goto('http://127.0.0.1:4173/dashboard/store-links', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)
const body = await page.evaluate(() => document.body.innerText.slice(0, 300))
console.log('BODY:', JSON.stringify(body))
console.log('ERRORS:', JSON.stringify(errors, null, 2))
await browser.close()