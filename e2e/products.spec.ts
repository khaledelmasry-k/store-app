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

// ─────────────────────────────────────────────────────────────
// Emulator Storage helpers (REST over http://localhost:9199).
// A download URL looks like
//   http://127.0.0.1:9199/v0/b/<bucket>/o/<url-encoded-object-path>
function storageUrlParts(url: string): { bucket: string; object: string } {
  const u = new URL(url)
  const seg = u.pathname.split('/') // ['', 'v0', 'b', '<bucket>', 'o', '<object>']
  return { bucket: seg[3], object: decodeURIComponent(seg.slice(5).join('/')) }
}

async function storageObjectExists(url: string): Promise<boolean> {
  const { bucket, object } = storageUrlParts(url)
  const res = await fetch(`http://127.0.0.1:9199/v0/b/${bucket}/o/${encodeURIComponent(object)}`)
  return res.status === 200
}

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
  // 2026 storage layout: every image lives in the product's OWN folder
  // `stores/{storeId}/products/{productId}/...` (product id pre-generated
  // before upload). The id embedded in the URL is the product doc id.
  const decodedFirst = decodeURIComponent(saved!.images[0])
  expect(decodedFirst).toContain(`/stores/${store.id}/products/${saved!.id}/`)
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
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })

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

test('checkout of M×2 decrements exactly the matching variant, leaving the other combos untouched', async ({ page }) => {
  const { name, slug } = ctx()
  const product = (await pollValue(() => productByName(name), (p) => p != null))!
  const store = (await storeBySlug(slug))!
  const before = (await pollValue(() => productByName(name), (p) => p != null))!

  await page.goto(`/store/${slug}/product/` + product.id, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /أسود/ }).click()
  await page.getByRole('button', { name: 'M', exact: true }).click()
  // Stepper: qty 1 → 2. The add guard caps qty at the variant's stock, and the
  // M variant has stock ≥2 here, so the step is allowed.
  await page.locator('.qty-stepper .qty-btn').nth(1).click()
  await expect(page.locator('.qty-stepper strong')).toHaveText('2')
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.cart-line')).toContainText('أسود • M')
  await expect(page.locator('.cart-line .qty-stepper strong')).toHaveText('2')
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()

  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل الكمية')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01011112223')
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'الجيزة' })
  await page.locator('.field', { hasText: 'المدينة' }).locator('input').fill('المعادي')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع 2')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })

  const order = (await pollValue(() => latestOrder(store.id), (o) => o != null && o.items.length > 0))!
  const item = order!.items[0]
  expect(item.quantity).toBe(2)
  expect(item.variantId).toBe(before.variants[0].id)

  // M (أسود/M) dropped 4 → 2; every other combo is untouched; flat stock is sum.
  const after = (await productByName(name))!
  expect(after.variants[0].stock).toBe(2) // أسود/M: decremented by exactly 2
  expect(after.variants[1].stock).toBe(0) // أسود/L: untouched
  expect(after.variants[2].stock).toBe(3) // أبيض/M: untouched
  expect(after.variants[3].stock).toBe(2) // أبيض/L: untouched
  expect(after.stock).toBe(7)
})

test('concurrent oversell: two checkouts racing for the last unit — exactly one succeeds, stock hits 0', async ({ browser }) => {
  const { name, slug } = ctx()
  const store = (await storeBySlug(slug))!
  const product = (await pollValue(() => productByName(name), (p) => p != null))!

  // Force the أسود/M variant down to a single unit; flat stock = sum of combos.
  const tightVariants = product.variants.map((v: any, i: number) => (i === 0 ? { ...v, stock: 1 } : v))
  await db.collection('products').doc(product.id).update({ variants: tightVariants, stock: 6 })

  const ordersBefore = (await db.collection('orders').where('storeId', '==', store.id).get()).size

  const prepareOrder = async (page: Page) => {
    await page.goto(`/store/${slug}/product/` + product.id, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /أسود/ }).click()
    await page.getByRole('button', { name: 'M', exact: true }).click()
    await expect(page.getByText('متوفر: 1')).toBeVisible()
    await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
    await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.cart-line')).toHaveCount(1)
    await page.getByRole('button', { name: 'إتمام الطلب' }).click()
    await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل السباق')
    await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01011112224')
    await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'الجيزة' })
    await page.locator('.field', { hasText: 'المدينة' }).locator('input').fill('المعادي')
    await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع 3')
  }

  // Independent storage/contexts so each racer owns its own cart and fires its
  // own createOrder call. Both hit confirm at the same instant.
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()
  await prepareOrder(pageA)
  await prepareOrder(pageB)
  await Promise.all([
    pageA.getByRole('button', { name: /تأكيد الطلب/ }).click(),
    pageB.getByRole('button', { name: /تأكيد الطلب/ }).click(),
  ])

  const resultOf = async (p: Page): Promise<'ok' | 'err'> => {
    const ok = p.getByText('تم إنشاء طلبك بنجاح').first()
    const err = p.getByText('تعذر إرسال الطلب').first()
    // Race both outcomes: the loser's error toast auto-dismisses within a few
    // seconds, so a sequential "wait ok, then err" would miss it.
    return Promise.race([
      ok.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'ok' as const),
      err.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'err' as const),
    ])
  }
  const [rA, rB] = await Promise.all([resultOf(pageA), resultOf(pageB)])

  // Exactly one racer wins the transaction; the other is rejected with
  // failed-precondition (الكمية غير متوفرة) because the stock was already spent.
  const outcomes = [rA, rB].sort().join(',')
  expect(outcomes).toBe('err,ok')

  const ordersAfter = (await db.collection('orders').where('storeId', '==', store.id).get()).size
  expect(ordersAfter).toBe(ordersBefore + 1)

  await ctxA.close()
  await ctxB.close()

  const depleted = (await productByName(name))!
  expect(depleted.variants[0].stock).toBe(0)
  expect(depleted.stock).toBe(5)

  // Restore the M variant for the downstream cart-persistence test.
  const restored = depleted.variants.map((v: any, i: number) => (i === 0 ? { ...v, stock: 5 } : v))
  await db.collection('products').doc(product.id).update({ variants: restored, stock: 10 })
})

test('cancelling an order restores ONLY the purchased variant stock (other sizes untouched)', async ({ page }) => {
  const { uniq, name, slug, email } = ctx()
  const product = (await pollValue(() => productByName(name), (p) => p != null))!
  const store = (await storeBySlug(slug))!

  // Reset this product to a deterministic per-variant stock map so the assertions
  // do not depend on ordering of the earlier checkout tests in this serial run.
  // Layout is أسود/M, أسود/L, أبيض/M, أبيض/L.
  const resetVariants = product.variants.map((v: any, i: number) => ({
    ...v,
    stock: i === 0 ? 5 : i === 1 ? 0 : i === 2 ? 3 : 2,
  }))
  await db.collection('products').doc(product.id).update({ variants: resetVariants, stock: 10 })
  await pollValue(async () => ((await productByName(name))!.variants[0].stock === 5), Boolean)

  // Place an order for أسود/M (the 5-stock variant), qty 2 — only M is decremented.
  await page.goto(`/store/${slug}/product/` + product.id, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /أسود/ }).click()
  await page.getByRole('button', { name: 'M', exact: true }).click()
  await page.locator('.qty-stepper .qty-btn').nth(1).click() // qty 1 -> 2
  await expect(page.locator('.qty-stepper strong')).toHaveText('2')
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()
  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل الإلغاء')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01099990001')
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'الجيزة' })
  await page.locator('.field', { hasText: 'المدينة' }).locator('input').fill('المعادي')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع الإلغاء')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })

  const order = (await pollValue(() => latestOrder(store.id), (o) => o != null && o.items.length > 0))!
  const item = order!.items[0]
  expect(item.variantId).toBe(product.variants[0].id)
  expect(item.quantity).toBe(2)

  // Checkout decremented ONLY the matched variant; other sizes untouched, aggregate recomputed.
  const afterOrder = (await productByName(name))!
  expect(afterOrder.variants[0].stock).toBe(3) // أسود/M: 5 -> 3
  expect(afterOrder.variants[1].stock).toBe(0) // أسود/L: untouched
  expect(afterOrder.variants[2].stock).toBe(3) // أبيض/M: untouched
  expect(afterOrder.variants[3].stock).toBe(2) // أبيض/L: untouched
  expect(afterOrder.stock).toBe(8) // aggregate = sum of variants

  // Cancel from the merchant dashboard via OrderDetails → Select CANCELLED → Update.
  await login(page, 'merchant', email, 'Products12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto(`/dashboard/orders/${order.id}`, { waitUntil: 'domcontentloaded' })
  await page.locator('select').selectOption({ value: 'CANCELLED' })
  await page.getByRole('button', { name: 'تحديث' }).click()
  await expect(page.getByText('تم تحديث حالة الطلب')).toBeVisible({ timeout: 15000 })

  // Cancel restored ONLY the same variant by exactly qty; others still untouched.
  const afterCancel = (await productByName(name))!
  expect(afterCancel.variants[0].stock).toBe(5) // restored: 3 -> 5
  expect(afterCancel.variants[1].stock).toBe(0) // untouched
  expect(afterCancel.variants[2].stock).toBe(3) // untouched
  expect(afterCancel.variants[3].stock).toBe(2) // untouched
  expect(afterCancel.stock).toBe(10) // aggregate recomputed
  await page.screenshot({ path: `e2e/shots/products-cancel-restore-${uniq}.png` })
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
  const otherStore = (await storeBySlug('test-store-b'))!
  const inOther = await db
    .collection('products')
    .where('storeId', '==', otherStore.id)
    .where('name', '==', name)
    .get()
  expect(inOther.empty).toBe(true)

  // And it is not surfaced in another store's catalog.
  await page.goto('/store/test-store-b', { waitUntil: 'domcontentloaded' })
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

// ─────────────────────────────────────────────────────────────
// Bundle (quantity) pricing — total price per tier, never unit × qty
//
// NOTE: these tests reuse the store already created by ensureProductsStore
// (products-<uniq>). Creating dedicated stores here would add extra merchant
// rows and overflow the paginated platform merchants table asserted on in
// emulator.spec.ts (see its "reuse this project's flow store" comment).
// ─────────────────────────────────────────────────────────────

function qtyCtx() {
  const p = test.info().project.name
  const uniq = p === 'desktop' ? 'desktop' : `m${p.replace('mobile-', '')}`
  return { uniq, name: `علبة شاي بالباقات ${uniq}`, slug: `products-${uniq}`, email: `products-${uniq}@mk.test` }
}

test('merchant creates a bundle-priced product (1→500 / 2→900 / 3→1200 / 4→1400)', async ({ page }) => {
  const { uniq, name } = qtyCtx()
  const { email } = await ensureProductsStore(uniq)

  await login(page, 'merchant', email, 'Products12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'منتج جديد' }).click()

  await page.locator('.drawer .field', { hasText: 'اسم المنتج' }).locator('input').fill(name)
  await page.locator('.drawer .field', { hasText: 'الوصف' }).locator('textarea').fill('باقات شاي')
  await page.locator('.drawer input[type="number"]').nth(0).fill('500')
  await page.locator('.drawer .field', { hasText: 'المخزون' }).locator('input').fill('50')

  // Switch to quantity pricing.
  await page.locator('.drawer .field', { hasText: 'طريقة التسعير' }).locator('select').selectOption({ label: 'سعر حسب الكمية (أسعار متدرجة)' })

  // Add four tiers: quantity → total price.
  await page.getByRole('button', { name: 'إضافة مستوى سعري' }).click()
  await page.getByRole('button', { name: 'إضافة مستوى سعري' }).click()
  await page.getByRole('button', { name: 'إضافة مستوى سعري' }).click()
  await page.getByRole('button', { name: 'إضافة مستوى سعري' }).click()
  const tierRows = page.locator('.qty-tier-editor-row')
  await expect(tierRows).toHaveCount(4)
  // Each row: [up][down][qty input][total price input][delete]
  const setTier = async (i: number, qty: string, price: string) => {
    const inputs = tierRows.nth(i).locator('input[type="number"]')
    await inputs.nth(0).fill(qty)
    await inputs.nth(1).fill(price)
  }
  await setTier(0, '1', '500')
  await setTier(1, '2', '900')
  await setTier(2, '3', '1200')
  await setTier(3, '4', '1400')

  // Duplicate quantity rejected on save.
  await setTier(3, '2', '1400')
  await page.getByRole('button', { name: 'حفظ ونشر' }).click()
  await expect(page.getByText('لا يمكن تكرار نفس عدد القطع')).toBeVisible({ timeout: 15000 })
  await setTier(3, '4', '1400')

  // Invalid price (< 0) rejected.
  await setTier(3, '4', '-5')
  await page.getByRole('button', { name: 'حفظ ونشر' }).click()
  await expect(page.getByText('السعر الإجمالي يجب أن يكون أكبر من أو يساوي صفر')).toBeVisible()
  await setTier(3, '4', '1400')

  // Save & publish.
  await page.getByRole('button', { name: 'حفظ ونشر' }).click()
  await expect(page.locator('.drawer')).toHaveCount(0, { timeout: 15000 })

  const saved = (await pollValue(() => productByName(name), (p) => p != null))!
  expect(saved.pricingMode).toBe('quantity')
  const tiers = (saved.quantityTiers || []).map((t: any) => ({ quantity: t.quantity, price: t.price }))
  expect(tiers).toEqual([
    { quantity: 1, price: 500 },
    { quantity: 2, price: 900 },
    { quantity: 3, price: 1200 },
    { quantity: 4, price: 1400 },
  ])
  await page.screenshot({ path: `e2e/shots/qty-created-${uniq}.png` })
})

test('editing and deleting a bundle tier persists', async ({ page }) => {
  const { name } = qtyCtx()
  const { email } = qtyCtx()
  await pollValue(() => productByName(name), (p) => p != null)

  await login(page, 'merchant', email, 'Products12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })

  // Open the edit drawer for the qty product row (table row on desktop, card on mobile).
  const row = page.locator('.table tbody tr, .card-table-card').filter({ hasText: name }).first()
  await row.getByTitle('تعديل').click()
  await expect(page.locator('.drawer')).toBeVisible()
  await expect(page.locator('.qty-tier-editor-row')).toHaveCount(4)

  // Change tier 4 (1400) → 5 (1600), delete tier 1 (500).
  const lastInputs = page.locator('.qty-tier-editor-row').nth(3).locator('input[type="number"]')
  await lastInputs.nth(0).fill('5')
  await lastInputs.nth(1).fill('1600')
  await page.locator('.qty-tier-editor-row').nth(0).getByTitle('حذف المستوى').click()
  await expect(page.locator('.qty-tier-editor-row')).toHaveCount(3)

  await page.getByRole('button', { name: 'حفظ المنتج' }).click()
  await expect(page.locator('.drawer')).toHaveCount(0, { timeout: 15000 })

  const updated = (await pollValue(() => productByName(name), (p) => p != null))!
  const tiers = (updated.quantityTiers || []).map((t: any) => ({ quantity: t.quantity, price: t.price }))
  expect(tiers).toEqual([
    { quantity: 2, price: 900 },
    { quantity: 3, price: 1200 },
    { quantity: 5, price: 1600 },
  ])
})

test('storefront: selecting bundle 3 → cart lineTotal 1200 (no multiplication), order snapshot matches', async ({ page }) => {
  const { uniq, name, slug } = qtyCtx()
  const store = (await storeBySlug(slug))!
  const product = (await pollValue(() => productByName(name), (p) => p != null))!

  // The edit test removed tier 1 (500). Restore the canonical 4-tier product for
  // the storefront flow so tiers are 1→500/2→900/3→1200/4→1400.
  await db.collection('products').doc(product.id).update({
    quantityTiers: [
      { quantity: 1, price: 500 },
      { quantity: 2, price: 900 },
      { quantity: 3, price: 1200 },
      { quantity: 4, price: 1400 },
    ],
  })

  await page.goto(`/store/${slug}/product/` + product.id, { waitUntil: 'domcontentloaded' })

  // Tier selector shows the four bundles with TOTAL prices.
  await expect(page.locator('.qty-tier-btn')).toHaveCount(4)
  await expect(page.locator('.qty-tier-btn').nth(2)).toContainText('3')
  await expect(page.locator('.qty-tier-btn').nth(2)).toContainText(/١٬٢٠٠|1,200/)

  // Default selection is the first tier (1 piece → 500 total).
  await expect(page.locator('.stat-value')).toContainText(/٥٠٠|500/)

  // Select bundle 3 → price shows 1200 (the bundle total, NOT 3× something).
  await page.locator('.qty-tier-btn').nth(2).click()
  await expect(page.locator('.stat-value')).toContainText(/١٬٢٠٠|1,200/)
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()

  await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await expect(page.locator('.cart-line')).toContainText('3 قطع')
  await expect(page.locator('.cart-line')).toContainText(/١٬٢٠٠|1,200/)
  // The cart line total is the bundle total — never 3 × 1200 = 3600.
  await expect(page.locator('.cart-line')).not.toContainText(/٣٬٦٠٠|3,600/)

  await page.getByRole('button', { name: 'إتمام الطلب' }).click()
  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل الباقات')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01022223333')
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'القاهرة' })
  await page.locator('.field', { hasText: 'المدينة' }).locator('input').fill('مدينة نصر')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع الباقات')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })

  const order = (await pollValue(() => latestOrder(store.id), (o) => o != null && o.items.length > 0 && o.items[0].productId === product.id))!
  const item = order.items[0]
  expect(item.quantity).toBe(3)
  expect(item.lineTotal).toBe(1200)
  expect(item.price).toBe(400) // effective unit = 1200 / 3
  expect(item.quantityTier).toEqual({ quantity: 3, price: 1200 })
  expect(order.subtotal).toBe(1200)
  // No accidental multiplication anywhere.
  expect(order.subtotal).not.toBe(3600)
  await page.screenshot({ path: `e2e/shots/qty-order-${uniq}.png` })
})

test('bundle + variants: color/size selection keeps the tier total; variant stock decrements by the tier qty', async ({ page }) => {
  const { uniq, slug } = qtyCtx()
  const store = (await storeBySlug(slug))!

  // A quantity-priced product WITH color/size variants (variants control stock,
  // the tier total is authoritative for price).
  const vname = `حقيبة هدايا بمتغيرات ${uniq}`
  const variantId = `v-${uniq}`
  await db.collection('products').add({
    storeId: store.id,
    name: vname,
    sku: null,
    description: 'باقات مع متغيرات',
    categoryId: null,
    price: 500,
    oldPrice: null,
    images: [],
    colorOptions: [{ id: 'c-black', name: 'أسود', hex: '#111111' }, { id: 'c-gold', name: 'ذهبي', hex: '#d4a017' }],
    colors: ['أسود', 'ذهبي'],
    sizes: ['M'],
    variants: [{ id: variantId, color: 'أسود', size: 'M', price: 500, stock: 7 }],
    pricingMode: 'quantity',
    quantityTiers: [
      { quantity: 1, price: 500 },
      { quantity: 2, price: 900 },
      { quantity: 3, price: 1200 },
    ],
    stock: 7,
    lowStockThreshold: 2,
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  const vproduct = (await pollValue(async () => {
    const snap = await db.collection('products').where('storeId', '==', store.id).where('name', '==', vname).limit(1).get()
    return snap.empty ? null : { id: snap.docs[0].id, ...(snap.docs[0].data() as any) }
  }, (p) => p != null))!

  await page.goto(`/store/${slug}/product/` + vproduct.id, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /أسود/ }).click()
  await page.getByRole('button', { name: 'M', exact: true }).click()
  // Select bundle 3 → price stays 1200 (bundle total), never variant price × 3.
  await page.locator('.qty-tier-btn').nth(2).click()
  await expect(page.locator('.stat-value')).toContainText(/١٬٢٠٠|1,200/)
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()

  await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await expect(page.locator('.cart-line')).toContainText('أسود • M')
  await expect(page.locator('.cart-line')).toContainText('3 قطع')
  await expect(page.locator('.cart-line')).toContainText(/١٬٢٠٠|1,200/)

  await page.getByRole('button', { name: 'إتمام الطلب' }).click()
  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل المتغيرات والباقات')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01033334444')
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'الإسكندرية' })
  await page.locator('.field', { hasText: 'المدينة' }).locator('input').fill('سيدي جابر')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع المتغيرات')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })

  const order = (await pollValue(() => latestOrder(store.id), (o) => o != null && o.items.length > 0 && o.items[0].productId === vproduct.id))!
  const item = order.items[0]
  expect(item.productId).toBe(vproduct.id)
  expect(item.variantId).toBe(variantId)
  expect(item.color).toBe('أسود')
  expect(item.size).toBe('M')
  expect(item.quantity).toBe(3)
  expect(item.lineTotal).toBe(1200)
  expect(item.quantityTier).toEqual({ quantity: 3, price: 1200 })

  // Variant stock decremented by the TIER quantity (7 − 3 = 4).
  const after = (await productByName(vname))!
  expect(after.variants[0].stock).toBe(4)
  expect(after.stock).toBe(4)
})

test('cart stepper for a bundle line snaps between configured tiers', async ({ page }) => {
  const { name, slug } = qtyCtx()
  const product = (await pollValue(() => productByName(name), (p) => p != null))!

  await page.goto(`/store/${slug}/product/` + product.id, { waitUntil: 'domcontentloaded' })
  await page.locator('.qty-tier-btn').nth(1).click() // bundle 2 → 900
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()

  await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await expect(page.locator('.cart-line')).toContainText(/٩٠٠|900/)

  // The + button must move 2 → 3 (next tier), recomputing the total to 1200.
  await page.locator('.cart-line .qty-stepper .qty-btn').nth(1).click()
  await expect(page.locator('.cart-line')).toContainText('3')
  await expect(page.locator('.cart-line')).toContainText(/١٬٢٠٠|1,200/)
  await expect(page.locator('.cart-line')).not.toContainText(/٣٬٦٠٠|3,600/)

  // And the − button moves back 3 → 2 → 900.
  await page.locator('.cart-line .qty-stepper .qty-btn').nth(0).click()
  await expect(page.locator('.cart-line')).toContainText('2')
  await expect(page.locator('.cart-line')).toContainText(/٩٠٠|900/)
})

test('deleting a product removes its own storage images but keeps shared ones', async ({ page }) => {
  const { uniq, email, name: vname } = ctx()
  const variantProduct = (await pollValue(() => productByName(vname), (p) => p != null))!
  const sharedUrl = variantProduct.images![1] // lives in the variant product's folder
  const dname = `منتج الحذف ${uniq}`

  await login(page, 'merchant', email, 'Products12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'منتج جديد' }).click()
  await page.locator('.drawer .field', { hasText: 'اسم المنتج' }).locator('input').fill(dname)
  await page.locator('.drawer input[type="number"]').nth(0).fill('88')
  await page.locator('.image-gallery-field input[type="file"]').setInputFiles([
    { name: 'del.png', mimeType: 'image/png', buffer: PNG },
  ])
  await expect(page.locator('.image-tile-img')).toHaveCount(1, { timeout: 15000 })
  await page.getByRole('button', { name: 'حفظ ونشر' }).click()
  await expect(page.locator('.drawer')).toHaveCount(0, { timeout: 15000 })

  // The disposable product now references its own uploaded file PLUS a URL
  // shared with another product. Deleting it must drop only the orphaned file.
  const created = (await pollValue(() => productByName(dname), (p) => p != null))!
  const ownUrl = created.images![0]
  expect(ownUrl).not.toBe(sharedUrl)
  await db.collection('products').doc(created.id).update({ images: [ownUrl, sharedUrl] })

  // Fresh list so the row carries the admin-updated images, then delete via UI.
  await page.reload({ waitUntil: 'domcontentloaded' })
  const row = page.locator('.table tbody tr, .card-table-card').filter({ hasText: dname }).first()
  await row.getByTitle('حذف').click()
  await page.getByRole('dialog').getByRole('button', { name: 'حذف' }).click()

  // Product document is gone…
  await pollValue(() => productByName(dname), (p) => p == null)
  // …its own uploaded image is removed from storage…
  await pollValue(() => storageObjectExists(ownUrl), (exists) => exists === false, 15000)
  // …and the shared image (still referenced by the variant product) survives.
  expect(await storageObjectExists(sharedUrl)).toBe(true)
  await page.screenshot({ path: `e2e/shots/products-deleted-${uniq}.png` })
})
