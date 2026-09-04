import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []

page.on('console', msg => {
  if (msg.type() === 'error') {
    errors.push(msg.text())
  }
})

page.on('pageerror', error => {
  errors.push(error.message)
})

try {
  await page.goto('http://localhost:5173/store/malek-store', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  
  const errorBoundary = await page.$('.error-boundary, [data-error-boundary], .error-fallback')
  const hasErrorBoundary = !!errorBoundary
  
  const storefrontContent = await page.$('.storefront-home, .storefront-page, .store-hero, .store-header')
  const hasStorefront = !!storefrontContent
  
  console.log('ERRORS:', JSON.stringify(errors, null, 2))
  console.log('HAS ERROR BOUNDARY:', hasErrorBoundary)
  console.log('HAS STOREFRONT CONTENT:', hasStorefront)
  console.log('TEST RESULT:', errors.length === 0 && !hasErrorBoundary && hasStorefront ? 'PASS' : 'FAIL')
} catch (e) {
  console.log('NAVIGATION ERROR:', e.message)
  console.log('TEST RESULT: FAIL')
}

await browser.close()
