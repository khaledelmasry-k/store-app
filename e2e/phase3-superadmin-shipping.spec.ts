import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { authenticateSuperAdmin } from './helpers/emulator-browser-auth'

const out = 'artifacts/phase3-superadmin-shipping'
const providers = [
  { id: 'wasla-test-carrier', name: 'وصلة' },
  { id: 'manual-test-carrier', name: 'Manual Carrier' },
  { id: 'future-test-carrier', name: 'Future Carrier' },
]

async function capture(page: Page, name: string, theme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: theme })
  await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
  await page.waitForTimeout(200)
  const state = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }))
  expect(state.dir).toBe('rtl')
  expect(state.overflow).toBe(false)
  mkdirSync(out, { recursive: true })
  await page.screenshot({ path: `${out}/${name}-${theme}.png` })
}

test('SuperAdmin provider-neutral shipping renders API, manual, and future metadata', async ({ browser }) => {
  test.setTimeout(600000)
  const viewports = process.env.PHASE3_SMOKE
    ? [[768, 1024]] as const
    : [[360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900]] as const

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await authenticateSuperAdmin(page)

  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height })
    await page.goto('/platform/shipping-companies', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Future Carrier', { exact: true })).toBeVisible()
    await capture(page, `list-${width}`, 'light')

    for (const provider of providers) {
      await page.goto(`/platform/shipping-companies/${provider.id}`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: provider.name })).toBeVisible()
      await capture(page, `${provider.id}-overview-${width}`, 'light')
      for (const tab of ['التكامل والتغطية', 'أهلية التجار', 'الاتفاق التجاري']) {
        await page.getByRole('tab', { name: tab }).click()
        await capture(page, `${provider.id}-${tab}-${width}`, 'light')
      }
    }
  }

  for (const [width, height] of [[390, 844], [1024, 768]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/platform/shipping-companies/future-test-carrier', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Future Carrier' })).toBeVisible()
    await capture(page, `future-${width}`, 'dark')
  }
  await context.close()
})
