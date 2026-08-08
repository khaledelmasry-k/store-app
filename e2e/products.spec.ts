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
function ctx() {
  const p = test.info().project.name
  const uniq = p === 'desktop' ? 'desktop' : `m${p.replace('mobile-', '')}`
  return {
    uniq,
    name: `قميص المتغيرات ${uniq}`,
    slug: `products-${uniq}`,
    email: `products-${uniq}@mk.test`,
  }
}

async function login(page: Page, role: 'platform' | 'merchant', email: string, password: string) {
  await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/dashboard|\/platform/, { timeout: 15000 })
}

async function storeBySlug(slug: string) {
  const snap = await db.collection('stores').where('slug', '==', slug).get()
  return snap.empty ? null : snap.docs[0]
}

// Creates (idempotently) a dedicated store per project so the products suite
// never mutates the seeded stores whose usage numbers other tests assert on.
async function ensureProductsStore(uniq: string) {
  const slug = `products-${uniq}`
  const email = `products-${uniq}@mk.test`
  const existing = await storeBySlug(slug)
  if (existing) return { storeId: existing.id, slug, email }

  const uid = `products-owner-${uniq}`
  await admin.auth().createUser({ uid, email, password: 'Products12345', displayName: 'صاحب المتغيرات' })
  await db.collection('users').doc(uid).set({
    uid, email, name: 'صاحب المتغيرات', role: 'merchant', storeIds: [uid], active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'products-spec',
  })
  await db.collection('stores').doc(uid).set({
    ref: slug, name: `متجر المتغيرات ${uniq}`, slug, active: true, published: true, ownerId: uid,
    currency: 'EGP', description: 'متجر مخصص لاختبارات المتغيرات',
    theme: { primary: '#6366f1', secondary: '#f59e0b', darkMode: false },
    seoTitle: `متجر المتغيرات ${uniq}`, seoDescription: 'متجر مخصص لاختبارات المتغيرات',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'products-spec',
  })
  await db.collection('subscriptions').add({
    storeId: uid, planId: 'plan-growth', planName: 'النمو', status: 'active', ordersUsed: 0,
    requestNote: 'من اختبارات المتغيرات',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'products-spec',
  })
  return { storeId: uid, slug, email }
}

async function productByName(name: string) {
  const snap = await db.collection('products').where('name', '==', name).limit(1).get()
  return snap.empty ? null : { id: snap.docs[0].id, ...(snap.docs[0].data() as any) }
}

async function latestOrder(storeId: string) {
  const snap = await db.collection('orders').where('storeId', '==', storeId).get()
  const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
  docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  return docs[0] || null
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

// 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

test.describe.configure({ mode: 'serial' })

test('merchant creates a variant product with uploaded images, colors, sizes, stock', async ({ page }) => {
  const { uniq, name } = ctx()
  const { slug, email } = await ensureProductsStore(uniq)
  const store = (await storeBySlug(slug))!
  const before = (await db.collection('products').where('storeId', '==', store.id).get()).size

  await login(page, 'merchant', email, 'Products12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'منتج جديد' }).click()

  // Basic fields.
  await page.locator('.drawer .field', { hasText: 'اسم المنتج' }).locator('input').fill(name)
  await page.locator('.drawer .field', { hasText: 'الوصف' }).locator('textarea').fill('وصف المتغيرات للمنتج')
  await page.locator('.drawer input[type="number"]').nth(0).fill('199')
  await page.locator('.drawer input[type="number"]').nth(1).fill('249')

  // Upload two images through the emulator storage path.
  const fileInput = page.locator('.image-gallery-field input[type="file"]')
  await fileInput.setInputFiles([
    { name: 'front.png', mimeType: 'image/png', buffer: PNG },
    { name: 'back.png', mimeType: 'image/png', buffer: PNG },
  ])
  await expect(page.locator('.image-tile-img')).toHaveCount(2, { timeout: 15000 })

  // Add colors via the one-tap presets, then attach a dedicated image per color.
  await page.locator('.color-preset-chip', { hasText: 'أسود' }).click()
  await page.locator('.color-preset-chip', { hasText: 'أبيض' }).click()
  const colorFileInput = (i: number) => page.locator('.color-row').nth(i).locator('input[type="file"]')
  await colorFileInput(0).setInputFiles([{ name: 'black.png', mimeType: 'image/png', buffer: PNG }])
  await colorFileInput(1).setInputFiles([{ name: 'white.png', mimeType: 'image/png', buffer: PNG }])
  await expect(page.locator('.color-row-thumb')).toHaveCount(2, { timeout: 15000 })

  // Add sizes, generate the variant matrix, set per-variant stock.
  const sizeInput = page.locator('.size-input')
  await sizeInput.fill('M')
  await sizeInput.press('Enter')
  await sizeInput.fill('L')
  await sizeInput.press('Enter')
  await page.getByRole('button', { name: 'إنشاء المتغيرات' }).click()
  await expect(page.locator('.variant-stock')).toHaveCount(4, { timeout: 15000 })

  // 4 combos: أسود/M, أسود/L, أبيض/M, أبيض/L. L for أسود has 0 stock (unavailable).
  const stocks = [5, 0, 3, 2]
  for (let i = 0; i < stocks.length; i++) {
    await page.locator('.variant-stock').nth(i).fill(String(stocks[i]))
  }
  await page.locator('.variant-price').nth(0).fill('179')

  // Save & publish.
  await page.getByRole('button', { name: 'حفظ ونشر' }).click()
  await expect(page.locator('.drawer')).toHaveCount(0, { timeout: 15000 })

  // Server-side state: product persisted with variants, colors and image URLs.
  const saved = (await pollValue(() => productByName(name), (p) => p != null))!
  expect(saved).not.toBeNull()
  expect(saved!.storeId).toBe(store.id)
  expect(saved!.active).toBe(true)
  expect(saved!.variants).toHaveLength(4)
  expect(saved!.colorOptions).toHaveLength(2)
  expect(saved!.sizes).toEqual(['M', 'L'])
  expect(saved!.images).toHaveLength(4)
  expect(saved!.images[0]).toMatch(/^http/)
  expect(saved!.stock).toBe(10)
  expect(saved!.variants[0].price).toBe(179)
  await expect
    .poll(() => db.collection('products').where('storeId', '==', store.id).get().then((s) => s.size), { timeout: 15000 })
    .toBe(before + 1)
  await page.screenshot({ path: `e2e/shots/products-created-${uniq}.png` })
})

test('storefront renders variant UI: gallery, color/size selectors, stock-aware, variant price', async ({ page }) => {
  const { uniq, name, slug } = ctx()
  await pollValue(() => productByName(name), (p) => p != null)

  await page.goto(`/store/${slug}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.store-card', { hasText: name }).click()
  await page.waitForURL(/\/product\//, { timeout: 15000 })

  // Gallery thumbs for all product images (2 uploads + 2 per-color); the first is the active display image.
  await expect(page.locator('.product-gallery-thumbs .gallery-thumb')).toHaveCount(4)
  await expect(page.locator('.gallery-thumb--active')).toHaveCount(1)

  // Color buttons with hex swatches; size buttons present.
  await expect(page.locator('.color-btn')).toHaveCount(2)
  await expect(page.locator('.color-btn-swatch')).toHaveCount(2)
  await expect(page.locator('.size-btn')).toHaveCount(2)

  // Before choosing a color the sizes are not selectable (no color selected yet).
  await expect(page.getByText('اختر اللون أولاً.')).toBeVisible()

  // Selecting أسود enables M (stock 5) and disables L (stock 0).
  await page.getByRole('button', { name: /أسود/ }).click()
  await expect(page.locator('.size-btn').nth(0)).not.toBeDisabled()
  await expect(page.locator('.size-btn').nth(1)).toBeDisabled()
  await expect(page.locator('.size-btn').nth(1)).toContainText('نفد')

  // Choosing M shows the variant price override and stock.
  await page.getByRole('button', { name: 'M', exact: true }).click()
  await expect(page.getByText('متوفر: 5')).toBeVisible()
  await expect(page.locator('.stat-value')).toContainText(/١٧٩|179/)

  // Add to cart → cart line carries the variant label.
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await expect(page.locator('.cart-line')).toContainText('أسود • M')
  await page.screenshot({ path: `e2e/shots/products-cart-${uniq}.png` })
})

test('checkout writes variantId to the order and decrements that variant stock', async ({ page }) => {
  const { name, slug } = ctx()
  const product = (await pollValue(() => productByName(name), (p) => p != null))!
  const store = (await storeBySlug(slug))!

  await page.goto(`/store/${slug}/product/` + product.id, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /أسود/ }).click()
  await page.getByRole('button', { name: 'M', exact: true }).click()
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()

  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل المتغيرات')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01011112222')
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'الجيزة' })
  await page.locator('.field', { hasText: 'المدينة' }).locator('input').fill('المعادي')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع 1')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم تأكيد طلبك!')).toBeVisible({ timeout: 30000 })

  const order = (await pollValue(() => latestOrder(store.id), (o) => o != null && o.items.length > 0))!
  const item = order!.items[0]
  expect(item.productId).toBe(product.id)
  expect(item.variantId).toBe(product.variants[0].id)
  expect(item.color).toBe('أسود')
  expect(item.size).toBe('M')
  expect(item.price).toBe(179)

  // The exact variant's stock decreased (5 → 4); flat stock also decreased.
  const after = (await productByName(name))!
  expect(after.variants[0].stock).toBe(4)
  expect(after.variants[1].stock).toBe(0)
  expect(after.stock).toBe(9)
})

test('cart persists variant selection across reload and re-login', async ({ page }) => {
  const { name, slug, email } = ctx()
  const product = (await pollValue(() => productByName(name), (p) => p != null))!

  await page.goto(`/store/${slug}/product/` + product.id, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /أسود/ }).click()
  await page.getByRole('button', { name: 'M', exact: true }).click()
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await expect(page.locator('.cart-line')).toContainText('أسود • M')

  // Re-login as the merchant (cart is scoped per store and survives sessions).
  await login(page, 'merchant', email, 'Products12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await expect(page.locator('.cart-line')).toContainText('أسود • M')
})

test('created product is isolated to its store (tenant isolation)', async ({ page }) => {
  const { name } = ctx()
  const otherStore = (await storeBySlug('active-shoes'))!
  const inOther = await db
    .collection('products')
    .where('storeId', '==', otherStore.id)
    .where('name', '==', name)
    .get()
  expect(inOther.empty).toBe(true)

  // And it is not surfaced in another store's catalog.
  await page.goto('/store/active-shoes', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-card', { hasText: name })).toHaveCount(0)
})

test('oversized image upload is rejected with an error', async ({ page }) => {
  const { email } = ctx()
  await login(page, 'merchant', email, 'Products12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'منتج جديد' }).click()

  const big = Buffer.alloc(5 * 1024 * 1024 + 1)
  await page.locator('.image-gallery-field input[type="file"]').setInputFiles({
    name: 'big.png',
    mimeType: 'image/png',
    buffer: big,
  })
  await expect(page.getByText(/حجم الصورة كبير جداً/)).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.image-tile-img')).toHaveCount(0)
})
