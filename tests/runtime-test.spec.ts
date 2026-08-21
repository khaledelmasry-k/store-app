import { test, expect } from '@playwright/test'

test('storefront home loads without runtime error', async ({ page }) => {
  const errors: string[] = []
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  
  page.on('pageerror', error => {
    errors.push(error.message)
  })
  
  await page.goto('http://localhost:5173/store/malek-store', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  
  // Check if error boundary triggered
  const errorBoundary = await page.$('.error-boundary, [data-error-boundary], .error-fallback')
  const hasErrorBoundary = !!errorBoundary
  
  // Check if storefront content rendered
  const storefrontContent = await page.$('.storefront-home, .storefront-page, .store-hero, .store-header')
  const hasStorefront = !!storefrontContent
  
  console.log('ERRORS:', JSON.stringify(errors, null, 2))
  console.log('HAS ERROR BOUNDARY:', hasErrorBoundary)
  console.log('HAS STOREFRONT CONTENT:', hasStorefront)
  
  expect(errors.length).toBe(0)
  expect(hasErrorBoundary).toBe(false)
  expect(hasStorefront).toBe(true)
})
