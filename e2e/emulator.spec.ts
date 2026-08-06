import { test, expect, type Page } from '@playwright/test'
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

// Point the Admin SDK at the local emulators BEFORE importing firebase-admin.
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'

const envRaw = readFileSync('.env.local', 'utf8')
const projectId = envRaw.match(/VITE_FIREBASE_PROJECT_ID=(\S+)/)?.[1] || 'mk-store-app'
if (!admin.apps.length) admin.initializeApp({ projectId })
const db = admin.firestore()

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
async function storeBySlug(slug: string) {
  const snap = await db.collection('stores').where('slug', '==', slug).get()
  return snap.empty ? null : snap.docs[0]
}

async function latestSub(storeId: string) {
  const snap = await db.collection('subscriptions').where('storeId', '==', storeId).get()
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
  docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  return docs[0] || null
}

async function countOrders(storeId: string) {
  const snap = await db.collection('orders').where('storeId', '==', storeId).get()
  return snap.size
}

async function countProducts(storeId: string) {
  const snap = await db.collection('products').where('storeId', '==', storeId).get()
  return snap.size
}

async function login(page: Page, role: 'platform' | 'merchant', email: string, password: string) {
  await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/dashboard|\/platform/, { timeout: 15000 })
}

async function logout(page: Page) {
  await page.locator('.user-chip').first().click()
  await page.getByText('تسجيل الخروج').first().click()
  await page.waitForURL(/\/login/, { timeout: 15000 })
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(500)
}

async function registerStore(
  page: Page,
  opts: { email: string; password: string; name: string; storeName: string; storeRef: string; planName: string },
) {
  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await page.locator('.auth-card input[type="email"]').fill(opts.email)
  await page.locator('.auth-card input[type="password"]').fill(opts.password)
  await page.locator('.auth-card input').nth(0).fill(opts.name)
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.locator('.plan-card', { hasText: opts.planName }).click()
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.locator('.auth-card input').nth(0).fill(opts.storeName)
  await page.locator('.auth-card input').nth(1).fill(opts.storeRef)
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
  await expect(page.getByText('تم تقديم طلب التسجيل')).toBeVisible({ timeout: 30000 })
}

async function merchantRow(page: Page, text: string) {
  return page.locator('tr, .card-table-card', { hasText: text }).first()
}

async function pollValue<T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeout = 15000): Promise<T> {
  const end = Date.now() + timeout
  let last: T | undefined
  while (Date.now() < end) {
    last = await fn()
    if (ok(last)) return last
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`pollValue timed out; last=${JSON.stringify(last)}`)
}

function shot(page: Page, name: string) {
  return page.screenshot({ path: `e2e/shots/${name}.png`, fullPage: false })
}

test.describe.configure({ mode: 'serial' })

// Namespace each run by Playwright project so desktop + mobile runs can share
// the same emulator data store without colliding.
const PASSWORD = 'Flow12345'
function ctx() {
  const p = test.info().project.name
  const uniq = p === 'desktop' ? 'desktop' : `m${p.replace('mobile-', '')}`
  return { uniq, email: `flow-${uniq}@mk.test`, ref: `flow-${uniq}`, storeName: `مقهى التدفق ${uniq}` }
}

// ─────────────────────────────────────────────────────────────
test('register new merchant (published=false, pending) + slug created', async ({ page }) => {
  const { email, storeName, ref } = ctx()
  await registerStore(page, {
    email,
    password: PASSWORD,
    name: 'مالك التدفق',
    storeName,
    storeRef: ref,
    planName: 'البداية',
  })

  const store = await pollValue(() => storeBySlug(ref), (s) => s != null)
  expect(store).not.toBeNull()
  expect(store!.data()!.published).toBe(false)
  const sub = await latestSub(store!.id)
  expect(sub).not.toBeNull()
  expect(sub!.status).toBe('pending')
  expect(sub!.planId).toBe('plan-starter')
})

test('register duplicate slug gets a numeric suffix', async ({ page }) => {
  const { uniq, storeName, ref } = ctx()
  await registerStore(page, {
    email: `flow-${uniq}-2@mk.test`,
    password: PASSWORD,
    name: 'مالك ثانٍ',
    storeName: `${storeName} نسخة`,
    storeRef: ref,
    planName: 'البداية',
  })
  const dup = await pollValue(() => storeBySlug(`${ref}-2`), (s) => s != null)
  expect(dup).not.toBeNull()
  expect(dup!.data()!.ref).toBe(`${ref}-2`)
})

test('platform approves -> merchant enabled; publish + theme + product', async ({ page }) => {
  const { uniq, email, ref } = ctx()
  // Admin approves the pending subscription.
  await login(page, 'platform', 'admin@mk.store', 'Admin12345')
  await page.waitForURL(/\/platform/, { timeout: 15000 })
  await page.goto('/platform/merchants', { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder(/بحث بالاسم/).fill(email)
  const row = await merchantRow(page, email)
  await expect(row).toBeVisible({ timeout: 15000 })
  await row.getByRole('button', { name: 'موافقة' }).click()

  const store = (await pollValue(() => storeBySlug(ref), (s) => s != null))!
  const ownerId = store.data()!.ownerId as string
  const subStatus = await pollValue(
    async () => (await latestSub(store.id))?.status,
    (s) => s === 'active',
  )
  expect(subStatus).toBe('active')
  const userSnap = await db.doc(`users/${ownerId}`).get()
  expect(userSnap.data()!.active).toBe(true)
  const authUser = await admin.auth().getUser(ownerId)
  expect(authUser.disabled).toBe(false)
  await shot(page, `platform-merchants-${uniq}`)
  await logout(page)

  // Merchant logs in now that the account is enabled.
  await login(page, 'merchant', email, PASSWORD)
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })

  // Publish from the dashboard toggle.
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.checklist')).toBeVisible({ timeout: 15000 })
  await page.locator('.toggle').click()
  await expect.poll(() => storeBySlug(ref).then((s) => s?.data()?.published), { timeout: 15000 }).toBe(true)

  // Set theme primary to a swatch (auto-saves after debounce).
  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' })
  await page.locator('.swatch[title="#16a34a"]').first().click()
  await expect
    .poll(() => storeBySlug(ref).then((s) => s?.data()?.theme?.primary), { timeout: 15000 })
    .toBe('#16a34a')
  await expect
    .poll(() => storeBySlug(ref).then((s) => s?.data()?.theme?.secondary), { timeout: 15000 })
    .toBe('#f59e0b')

  // Add a product via the products modal.
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'منتج جديد' }).click()
  await page.locator('.field', { hasText: 'اسم المنتج' }).locator('input').fill('بن التدفق المختص')
  await page.locator('.modal input[type="number"]').nth(0).fill('240')
  await page.locator('.modal input[type="number"]').nth(1).fill('300')
  await page.locator('.modal input[type="number"]').nth(2).fill('10')
  await page.getByRole('button', { name: 'حفظ المنتج' }).click()
  await expect.poll(() => countProducts(store.id), { timeout: 15000 }).toBe(1)
})

test('storefront theme vars, cart -> checkout -> order, ordersUsed increments', async ({ page }) => {
  const { uniq, ref, storeName } = ctx()
  const slug = ref
  await page.goto(`/store/${slug}`, { waitUntil: 'domcontentloaded' })

  // Theme CSS variables applied on the store shell.
  const vars = await page.locator('.store-shell').evaluate((el) => {
    const cs = getComputedStyle(el as HTMLElement)
    return {
      primary: cs.getPropertyValue('--primary').trim(),
      accent: cs.getPropertyValue('--store-accent').trim(),
    }
  })
  expect(vars.primary).toBe('#16a34a')
  expect(vars.accent).toBe('#f59e0b')

  // SEO title from the store name.
  await expect.poll(() => page.title()).toContain(storeName)
  await shot(page, `storefront-${uniq}`)

  // Go to a product and add to cart.
  await page.locator('.store-card').first().click()
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()

  // Fill checkout and submit.
  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل التدفق')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01099990000')
  await page
    .locator('.field', { hasText: 'المحافظة' })
    .locator('select')
    .selectOption({ label: 'القاهرة' })
  await page.locator('.field', { hasText: 'المدينة' }).locator('input').fill('مدينة نصر')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع 9، عمارة 4')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()

  await expect(page.getByText('تم تأكيد طلبك!')).toBeVisible({ timeout: 30000 })
  await shot(page, `checkout-confirmed-${uniq}`)

  const store = (await storeBySlug(slug))!
  // Order persisted server-side.
  await expect.poll(() => countOrders(store.id), { timeout: 15000 }).toBe(1)
  // ordersUsed incremented inside the createOrder transaction.
  await expect.poll(async () => (await latestSub(store.id))?.ordersUsed, { timeout: 15000 }).toBe(1)
  // Order number generated from the per-store counter.
  const orderSnap = await db.collection('orders').where('storeId', '==', store.id).get()
  expect(orderSnap.docs[0].data()!.orderNumber).toBe('ORD-00001')
})

test('unpublished store shows coming-soon to visitors; owner can preview', async ({ page }) => {
  const { uniq } = ctx()
  // Anonymous visitor -> coming soon.
  await page.goto('/store/zeina-gifts', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-coming-soon')).toBeVisible({ timeout: 15000 })
  await shot(page, `coming-soon-${uniq}`)

  // Owner (seeded store C) can preview the storefront.
  await login(page, 'merchant', 'owner@c.store', 'Owner12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto('/store/zeina-gifts', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-coming-soon')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('.store-header')).toBeVisible()
})

test('platform Merchants shows seeded usage bars (132/200 moderate, 46/50 near)', async ({ page }) => {
  await login(page, 'platform', 'admin@mk.store', 'Admin12345')
  await page.goto('/platform/merchants', { waitUntil: 'domcontentloaded' })

  const rowA = await merchantRow(page, 'beit-el-shay')
  await expect(rowA).toContainText('132 / 200', { timeout: 15000 })
  await expect(rowA).toContainText('66%')
  await expect(rowA).toContainText('متوسط')
  await shot(page, 'platform-usage-a')

  const rowB = await merchantRow(page, 'active-shoes')
  await expect(rowB).toContainText('46 / 50')
  await expect(rowB).toContainText('92%')
  await expect(rowB).toContainText('قريب من الحد')
  await shot(page, 'platform-usage-b')

  // Pending + expired segments still present from the seed.
  const rowC = await merchantRow(page, 'zeina-gifts')
  await expect(rowC).toContainText('قيد الانتظار')
  const rowD = await merchantRow(page, 'noor-cafe')
  await expect(rowD).toContainText('منتهي')
})

test('merchant subscription page shows persisted usage (132/200) and countdown', async ({ page }) => {
  await login(page, 'merchant', 'owner@a.store', 'Owner12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto('/dashboard/subscription', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('132 من 200 طلب')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('66%')).toBeVisible()
  await expect(page.getByText('متوسط')).toBeVisible()
  await shot(page, 'merchant-subscription-a')

  // Merchant dashboard usage banner too.
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('132 / 200 طلب')).toBeVisible({ timeout: 15000 })
})
