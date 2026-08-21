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
function uniq() {
  const p = test.info().project.name
  return p === 'desktop' ? 'desktop' : `m${p.replace('mobile-', '')}`
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`/login?role=merchant`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  if ((await page.locator('button[type="submit"]').count()) === 0) {
    const logout = page.locator('.sidebar-logout:visible').first()
    if ((await logout.count()) === 0) {
      await page.locator('.sidebar-toggle:visible').first().click()
    }
    await page.locator('.sidebar-logout:visible').first().click()
    await page.waitForURL(/\/login/, { timeout: 15000 })
    await page.goto('about:blank').catch(() => {})
    await page.goto(`/login?role=merchant`, { waitUntil: 'domcontentloaded' })
  }
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
}

async function latestSub(storeId: string) {
  const snap = await db.collection('subscriptions').where('storeId', '==', storeId).get()
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
  docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  return docs[0] || null
}

async function productCount(storeId: string) {
  const snap = await db.collection('products').where('storeId', '==', storeId).get()
  return snap.size
}

// Seeds an ACTIVE Free-plan tenant (mirrors registerMerchant for a free plan:
// status active, no trial window, lives forever, hard limits from plan-free).
async function makeFreeStore(tag: string, extraProducts = 0) {
  const u = uniq()
  const uid = `saas-free-owner-${tag}-${u}`
  const storeId = `saas-free-store-${tag}-${u}`
  const email = `saas-free-${tag}-${u}@mk.test`
  const us = admin.firestore.FieldValue.serverTimestamp.bind(admin.firestore.FieldValue)
  await admin.auth().createUser({ uid, email, password: 'Flow12345', displayName: 'صاحب الباقة المجانية' }).catch(() => {})
  await db.collection('users').doc(uid).set({
    uid, email, name: 'صاحب الباقة المجانية', role: 'merchant', storeIds: [storeId], active: true,
    createdAt: us(), updatedAt: us(), createdBy: 'saas-spec',
  })
  await db.collection('stores').doc(storeId).set({
    ref: storeId, name: `المتجر المجاني ${tag}`, slug: storeId, active: true, published: true, ownerId: uid,
    currency: 'EGP', description: 'متجر الباقة المجانية',
    theme: { primary: '#6366f1', secondary: '#f59e0b', darkMode: false },
    createdAt: us(), updatedAt: us(), createdBy: 'saas-spec',
  })
  await db.collection('subscriptions').add({
    storeId, planId: 'plan-free', planName: 'الأساسية', status: 'active', billingCycle: 'monthly',
    periodNumber: 0, ordersUsed: 0, normalPriceSnapshot: 0, launchPriceSnapshot: 0,
    createdAt: us(), updatedAt: us(), createdBy: 'saas-spec',
  })
  for (let i = 0; i < extraProducts; i++) {
    await db.collection('products').add({
      storeId, name: `منتج الباقة المجانية ${tag}-${i}`, price: 10 + i, stock: 1, active: true,
      images: [], variants: [], colors: [], sizes: [],
      createdAt: us(), updatedAt: us(), createdBy: 'saas-spec',
    })
  }
  return { uid, storeId, email, password: 'Flow12345' }
}

async function createWithinDrawer(page: Page, name: string) {
  await page.getByRole('button', { name: 'منتج جديد' }).click()
  await page.locator('.drawer .field', { hasText: 'اسم المنتج' }).locator('input').fill(name)
  await page.locator('.drawer input[type="number"]').nth(0).fill('120')
  await page.getByRole('button', { name: 'حفظ المنتج' }).click()
}

// 1x1 transparent PNG padded to ~600 KB so the storage meter shows >0 MB.
function padPng(): string {
  const pixel =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  const body = Buffer.from(pixel, 'base64')
  const padded = Buffer.concat([body, Buffer.alloc(600 * 1024, 0)])
  return padded.toString('base64')
}

test.describe.configure({ mode: 'serial' })

test('free store blocks quantity pricing inline and never creates the product', async ({ page }) => {
  const { storeId, email, password } = await makeFreeStore('qtygate')

  await login(page, email, password)
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'منتج جديد' }).click()

  // The free tier shows a clear upgrade lock banner for advanced product modes.
  await expect(page.getByText('هذه المزايا غير متوفرة في باقتك الحالية')).toBeVisible({ timeout: 15000 })

  // Selecting quantity pricing is blocked with an inline error.
  await page.locator('.drawer .field', { hasText: 'اسم المنتج' }).locator('input').fill('منتج الكمية مقفل')
  await page.locator('.drawer input[type="number"]').nth(0).fill('100')
  await page.locator('.drawer .field', { hasText: 'طريقة التسعير' }).locator('select').selectOption({ label: 'سعر حسب الكمية (أسعار متدرجة)' })
  await expect(page.getByText('ميزة التسعير حسب الكمية تتطلب ترقية الباقة')).toBeVisible({ timeout: 15000 })

  // Back to standard pricing, attempt to save anyway → still no product written.
  await page.locator('.drawer .field', { hasText: 'طريقة التسعير' }).locator('select').selectOption({ label: 'سعر موحد (ثابت)' })
  await page.getByRole('button', { name: 'حفظ المنتج' }).click()
  await expect(page.locator('.drawer')).toBeVisible({ timeout: 15000 })
  expect(await productCount(storeId)).toBe(0)
})

test('free product cap (50) is enforced server-side — 51st product is rejected', async ({ page }) => {
  const { storeId, email, password } = await makeFreeStore('cap', 50)

  await login(page, email, password)
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await createWithinDrawer(page, 'المؤدي للمنتج الحادي والخمسين')

  // The save fails and the drawer stays open; nothing was written to Firestore.
  await expect(page.locator('.drawer')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.form-error-banner')).toBeVisible({ timeout: 15000 })
  expect(await productCount(storeId)).toBe(50)
})

test('merchant upgrades free → growth from the subscription page; advanced features unlock', async ({ page }) => {
  const { storeId, email, password } = await makeFreeStore('upgrade')

  await login(page, email, password)
  await page.goto('/dashboard/subscription', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'تغيير الباقة' })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'تغيير الباقة' }).click()

  // Pick the Growth plan from the modal and confirm. The modal is scoped away
  // from the featured card above; the target card is identified by its exact
  // plan-name heading so ordering never matters.
  await page.locator('.modal .mk-pricing-card').filter({ has: page.getByRole('heading', { name: 'GROWTH', exact: true }) }).getByRole('button', { name: 'اختيار' }).click()
  await page.getByRole('button', { name: 'تأكيد التغيير' }).click()
  await expect(page.getByText('تم تغيير باقتك بنجاح')).toBeVisible({ timeout: 15000 })

  await expect.poll(async () => (await latestSub(storeId))?.planId, { timeout: 15000 }).toBe('plan-growth')

  // Quantity pricing is now selectable without an inline error.
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'منتج جديد' }).click()
  await page.locator('.drawer .field', { hasText: 'اسم المنتج' }).locator('input').fill('منتج الكمية بعد الترقية')
  await page.locator('.drawer input[type="number"]').nth(0).fill('200')
  await page.locator('.drawer .field', { hasText: 'طريقة التسعير' }).locator('select').selectOption({ label: 'سعر حسب الكمية (أسعار متدرجة)' })
  await expect(page.getByText('ميزة التسعير حسب الكمية تتطلب ترقية الباقة')).toHaveCount(0, { timeout: 5000 })
  await expect(page.locator('.qty-tier-editor')).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'إضافة مستوى سعري' }).click()
  const tier = page.locator('.qty-tier-editor-row').first()
  await tier.locator('input[type="number"]').nth(0).fill('3')
  await tier.locator('input[type="number"]').nth(1).fill('540')
  await page.getByRole('button', { name: 'حفظ المنتج' }).click()
  await expect(page.locator('.drawer')).toHaveCount(0, { timeout: 15000 })
  expect(await productCount(storeId)).toBe(1)
})

test('variant product creation works after upgrade but is denied on free', async ({ page }) => {
  // Part 1: a variant product attempt on the free tier is rejected by the server.
  const free = await makeFreeStore('variantfree')
  await login(page, free.email, free.password)
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'منتج جديد' }).click()
  await page.locator('.drawer .field', { hasText: 'اسم المنتج' }).locator('input').fill('قميص بمقاسات — مجاني')
  await page.locator('.drawer input[type="number"]').nth(0).fill('150')
  const sizeInput = page.locator('.size-input')
  await sizeInput.fill('M')
  await sizeInput.press('Enter')
  await page.getByRole('button', { name: 'إنشاء المتغيرات' }).click()
  await expect(page.locator('.variant-stock')).toHaveCount(1, { timeout: 15000 })
  await page.getByRole('button', { name: 'حفظ المنتج' }).click()
  await expect(page.locator('.drawer')).toBeVisible({ timeout: 15000 })
  expect(await productCount(free.storeId)).toBe(0)

  // Part 2: upgrade to Growth (also gate-checks the change callable) unlocks it.
  await page.goto('/dashboard/subscription', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'تغيير الباقة' }).click()
  await page.locator('.modal .mk-pricing-card').filter({ has: page.getByRole('heading', { name: 'GROWTH', exact: true }) }).getByRole('button', { name: 'اختيار' }).click()
  await page.getByRole('button', { name: 'تأكيد التغيير' }).click()
  await expect.poll(async () => (await latestSub(free.storeId))?.planId, { timeout: 15000 }).toBe('plan-growth')

  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'منتج جديد' }).click()
  await page.locator('.drawer .field', { hasText: 'اسم المنتج' }).locator('input').fill('قميص بمقاسات — نمو')
  await page.locator('.drawer input[type="number"]').nth(0).fill('160')
  const s2 = page.locator('.size-input')
  await s2.fill('L')
  await s2.press('Enter')
  await page.getByRole('button', { name: 'إنشاء المتغيرات' }).click()
  await expect(page.locator('.variant-stock')).toHaveCount(1, { timeout: 15000 })
  await page.locator('.variant-stock').nth(0).fill('7')
  await page.getByRole('button', { name: 'حفظ المنتج' }).click()
  await expect(page.locator('.drawer')).toHaveCount(0, { timeout: 15000 })
  expect(await productCount(free.storeId)).toBe(1)
})

test('storage quota meter reflects uploaded files on the subscription page', async ({ page }) => {
  const { storeId, email, password } = await makeFreeStore('storage')

  await login(page, email, password)
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'منتج جديد' }).click()
  await page.locator('.drawer .field', { hasText: 'اسم المنتج' }).locator('input').fill('منتج بصورة كبيرة')
  await page.locator('.drawer input[type="number"]').nth(0).fill('300')
  const fileInput = page.locator('.image-gallery-field input[type="file"]')
  await fileInput.setInputFiles([{ name: 'big.png', mimeType: 'image/png', buffer: Buffer.from(padPng(), 'base64') }])
  await expect(page.locator('.image-tile-img')).toHaveCount(1, { timeout: 15000 })
  await page.getByRole('button', { name: 'حفظ المنتج' }).click()
  await expect(page.locator('.drawer')).toHaveCount(0, { timeout: 15000 })
  expect(await productCount(storeId)).toBe(1)

  // The subscription page loads the authoritative storage usage (server-computed).
  await page.goto('/dashboard/subscription', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.storage-meter')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/تخزين الملفات: 1 من 200 ميجابايت/)).toBeVisible({ timeout: 15000 })
})
