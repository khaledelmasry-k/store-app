import { test, expect, type Page } from '@playwright/test'

// The storefront is a client-rendered SPA, so SEO tags are injected at runtime
// by StoreLayout/Product via the shared `setSeo` helper. Crawlers that execute
// JS (and social scrapers) rely on these being present and correct.
async function openStore(page: Page, slug: string) {
  await page.goto(`/store/${slug}/catalog`, { waitUntil: 'domcontentloaded' })
  // The storefront keeps realtime connections open, so never reaches
  // networkidle. Wait for a concrete shell element instead. NOTE: do not wait
  // on `.store-nav-link` — the desktop nav is hidden on narrow viewports and
  // the mobile nav only renders when the menu is open, so that selector is not
  // "visible" on mobile. `.store-header` is always rendered for published stores.
  await page.waitForSelector('.store-header', { state: 'visible', timeout: 30000 })
  // Allow the SEO useEffect to run and write the head tags.
  await page.waitForTimeout(300)
}

test('storefront sets title, description, OG and canonical', async ({ page }) => {
  await openStore(page, 'test-store-a')

  // Title reflects the store name.
  await expect(page).toHaveTitle(/TEST - متجر اختبار A/)

  // Meta description present.
  const description = page.locator('meta[name="description"]')
  await expect(description).toHaveCount(1)
  await expect(description).not.toHaveAttribute('content', '')

  // Open Graph tags.
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1)
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /.*\/store\/test-store-a$/)

  // Canonical link matches the store URL.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /.*\/store\/test-store-a$/)

  // Twitter card is configured.
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
})
