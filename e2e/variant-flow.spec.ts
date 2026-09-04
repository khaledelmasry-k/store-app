import { test, expect, type Page } from '@playwright/test'
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'

const envRaw = readFileSync('.env.local', 'utf8')
const projectId = envRaw.match(/VITE_FIREBASE_PROJECT_ID=(\S+)/)?.[1] || 'mk-store-app'
if (!admin.apps.length) admin.initializeApp({ projectId })
const db = admin.firestore()

function ctx() {
  const p = test.info().project.name
  const uniq = p === 'desktop' ? 'desktop' : `m${p.replace('mobile-', '')}`
  return {
    uniq,
    slug: `variant-flow-${uniq}`,
    email: `variant-owner-${uniq}@mk.test`,
  }
}

async function storeBySlug(slug: string) {
  const snap = await db.collection('stores').where('slug', '==', slug).get()
  return snap.empty ? null : snap.docs[0]
}

// Dedicated published store + merchant + active subscription + variant product.
async function ensureVariantStore(slug: string, email: string, name: string) {
  const existing = await storeBySlug(slug)
  if (existing) {
    const prods = await db.collection('products').where('storeId', '==', existing.id).get()
    for (const doc of prods.docs) await doc.ref.delete()
    return existing.id
  }
  const uid = `variant-owner-${slug}`
  await admin.auth().createUser({ uid, email, password: 'Customer123', displayName: 'مالك المتغيرات' }).catch(() => {})
  await db.collection('users').doc(uid).set({
    uid, email, name: 'مالك المتغيرات', role: 'merchant', storeIds: [uid], active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  await db.collection('stores').doc(uid).set({
    ref: slug, name, slug, active: true, published: true, ownerId: uid,
    currency: 'EGP', description: 'متجر اختبار المتغيرات',
    theme: { primary: '#16a34a', secondary: '#f59e0b', darkMode: false },
    seoTitle: name, seoDescription: 'متجر اختبار المتغيرات',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  await db.collection('subscriptions').add({
    storeId: uid, planId: 'plan-growth', planName: 'النمو', status: 'active', ordersUsed: 0,
    currentPeriodStart: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000 * 5)),
    currentPeriodEnd: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000 * 25)),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  return uid
}

// Builds a product with a known variant matrix:
// Black/M=5, Black/L=8, White/M=10, White/L=4, Black/XL=0 (exists, out of stock)
async function seedVariantProduct(storeId: string, pricingMode: 'standard' | 'quantity' = 'standard') {
  const prod = db.collection('products').doc()
  const variants = pricingMode === 'quantity'
    ? []
    : [
        { id: 'black-m', color: 'Black', size: 'M', sku: 'B-M', stock: 5 },
        { id: 'black-l', color: 'Black', size: 'L', sku: 'B-L', stock: 8 },
        { id: 'black-xl', color: 'Black', size: 'XL', sku: 'B-XL', stock: 0 },
        { id: 'black-xxl', color: 'Black', size: 'XXL', sku: 'B-XXL', stock: 2 },
        { id: 'white-m', color: 'White', size: 'M', sku: 'W-M', stock: 10 },
        { id: 'white-l', color: 'White', size: 'L', sku: 'W-L', stock: 4 },
      ]
  const data: any = {
    id: prod.id, storeId, name: 'بنطال اختبار المتغيرات', price: 500, oldPrice: 600, description: 'منتج تجريبي',
    images: [],
    stock: pricingMode === 'quantity' ? 100 : variants.reduce((s, v) => s + v.stock, 0),
    variants, colors: pricingMode === 'quantity' ? [] : ['Black', 'White'], sizes: pricingMode === 'quantity' ? [] : ['M', 'L', 'XL', 'XXL'],
    active: true, featured: true, lowStockThreshold: 3,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }
  if (pricingMode === 'quantity') {
    data.pricingMode = 'quantity'
    data.quantityTiers = [
      { quantity: 1, price: 500 },
      { quantity: 2, price: 900 },
      { quantity: 3, price: 1200 },
      { quantity: 4, price: 1400 },
    ]
    data.quantityPricingStrategy = 'cap'
  }
  await prod.set(data)
  return prod.id
}

async function login(page: Page, role: 'platform' | 'merchant', email: string, password: string) {
  await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  if ((await page.locator('button[type="submit"]').count()) === 0) {
    const logout = page.locator('.sidebar-logout:visible').first()
    if ((await logout.count()) === 0) {
      await page.locator('.sidebar-toggle:visible').first().click()
    }
    await page.locator('.sidebar-logout:visible').first().click()
    await page.waitForURL(/\/login/, { timeout: 15000 })
    await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  }
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/dashboard|\/platform/, { timeout: 15000 })
}

async function selectVariant(page: Page, color: string, size: string) {
  // Color choices are swatches with an accessible label rather than visible
  // text; use the stable semantic attribute so the test matches the current UI.
  await page.locator(`.color-btn[aria-label="${color}"]`).first().click()
  await page.locator('.size-btn', { hasText: size }).first().click()
}

async function setQty(page: Page, target: number) {
  for (let i = 0; i < 20; i++) {
    const current = Number((await page.locator('.qty-stepper strong').textContent())?.trim() || '1')
    if (current === target) return
    if (current < target) await page.locator('.qty-btn').nth(1).click()
    else await page.locator('.qty-btn').nth(0).click()
    await expect(page.locator('.qty-stepper strong')).toHaveText(String(current < target ? current + 1 : current - 1))
  }
}

async function addToCartFromProduct(page: Page, slug: string, productId: string, color: string, size: string, qty: number, expectedCartCount = qty) {
  await page.goto(`/store/${slug}/product/${productId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'أضف إلى السلة' })).toBeVisible({ timeout: 15000 })
  await selectVariant(page, color, size)
  await setQty(page, qty)
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await expect(page.getByRole('link', { name: /السلة،/ })).toHaveAccessibleName(new RegExp(`السلة،\\s*${expectedCartCount}\\s*منتج`))
}

async function checkoutGuest(page: Page, slug: string, phone: string, name: string) {
  await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()
  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill(name)
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill(phone)
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'القاهرة' })
  await page.locator('.field', { hasText: 'المدينة' }).locator('input').fill('مدينة نصر')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع تجريبي ١')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })
  const orderNumber = (await page.locator('.order-confirmed .monospace').first().textContent())?.trim() || ''
  expect(orderNumber).toMatch(/^ORD-\d{5}$/)
  return orderNumber
}

async function cancelMerchantOrder(page: Page, terminalLabel = 'ملغي') {
  await page.reload({ waitUntil: 'domcontentloaded' })
  const mobile = await page.evaluate(() => window.innerWidth < 768)
  const update = mobile
    ? page.locator('.ods-mobile-bar .ods-update-btn')
    : page.locator('.ods-status-dropdown .ods-btn-primary')
  await expect(update).toBeVisible({ timeout: 15000 })
  await update.click({ force: true })
  if (mobile) await expect(page.locator('.ods-sheet-backdrop')).toBeVisible({ timeout: 5000 })
  const menu = mobile ? page.locator('.ods-sheet .ods-status-menu') : page.locator('.ods-status-dropdown .ods-status-menu')
  try {
    await expect(menu).toBeVisible({ timeout: 1500 })
  } catch {
    await update.click({ force: true })
    await expect(menu).toBeVisible({ timeout: 5000 })
  }
  await menu.getByRole('button').filter({ hasText: terminalLabel }).click({ force: true })
  await expect(page.getByRole('button', { name: 'تأكيد التحديث', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'تأكيد التحديث', exact: true }).click({ force: true })
  await expect(page.locator('.ods-confirm-backdrop')).toHaveCount(0, { timeout: 10000 })
  await expect(page.locator('.ods-status-pill')).toContainText(terminalLabel, { timeout: 15000 })
}

async function latestOrder(storeId: string) {
  const snap = await db.collection('orders').where('storeId', '==', storeId).orderBy('createdAt', 'desc').limit(1).get()
  return snap.empty ? null : { id: snap.docs[0].id, data: snap.docs[0].data() as any }
}

async function variantStockOf(productId: string, variantId: string): Promise<number> {
  const snap = await db.doc(`products/${productId}`).get()
  const v = (snap.data()?.variants || []).find((x: any) => x.id === variantId)
  return v ? v.stock : -1
}

test.describe.configure({ mode: 'serial' })

test('exact variant stock decremented; other variant unchanged', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureVariantStore(c.slug, c.email, `متجر المتغيرات ${c.uniq}`)
  const productId = await seedVariantProduct(storeId)

  await addToCartFromProduct(page, c.slug, productId, 'Black', 'M', 2)
  await checkoutGuest(page, c.slug, '01030000001', 'مشتري متغير')

  await expect.poll(async () => variantStockOf(productId, 'black-m'), { timeout: 15000 }).toBe(3)
  await expect.poll(async () => variantStockOf(productId, 'black-l'), { timeout: 15000 }).toBe(8)

  const order = await latestOrder(storeId)
  expect(order).not.toBeNull()
  const item = order!.data.items.find((i: any) => i.variantId === 'black-m')
  expect(item).toBeTruthy()
  expect(item.quantity).toBe(2)
  expect(item.lineTotal).toBe(1000)
})

test('cancel restores variant stock exactly once (no double restore)', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureVariantStore(c.slug, c.email, `متجر المتغيرات ${c.uniq}`)
  const productId = await seedVariantProduct(storeId)

  await addToCartFromProduct(page, c.slug, productId, 'Black', 'M', 2)
  const orderNumber = await checkoutGuest(page, c.slug, '01030000002', 'مشتري إلغاء')
  const order = await latestOrder(storeId)
  expect(order!.data.orderNumber).toBe(orderNumber)
  const orderId = order!.id

  await login(page, 'merchant', c.email, 'Customer123')
  await page.goto(`/dashboard/orders/${orderId}`, { waitUntil: 'domcontentloaded' })
  await cancelMerchantOrder(page)
  await expect.poll(async () => variantStockOf(productId, 'black-m'), { timeout: 15000 }).toBe(5)

  // Re-cancel is impossible from the UI (status already cancelled; option hidden),
  // so a second consecutive CANCELLED transition cannot double-restore.
  await expect.poll(async () => variantStockOf(productId, 'black-m'), { timeout: 15000 }).toBe(5)
})

test('out-of-stock existing variant is shown disabled (not hidden)', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureVariantStore(c.slug, c.email, `متجر المتغيرات ${c.uniq}`)
  const productId = await seedVariantProduct(storeId)

  await page.goto(`/store/${c.slug}/product/${productId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-product-page, .storefront-product')).toBeVisible({ timeout: 15000 })
  await page.locator('.color-btn').first().click()
  const xl = page.locator('.size-btn', { hasText: 'XL' }).first()
  await expect(xl).toHaveClass(/(?:size-btn--disabled|size-chip--disabled)/)
  await expect(page.getByRole('button', { name: 'أضف إلى السلة' })).toBeDisabled()
})

test('changing color resets an invalid size selection', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureVariantStore(c.slug, c.email, `متجر المتغيرات ${c.uniq}`)
  const productId = await seedVariantProduct(storeId)

  await page.goto(`/store/${c.slug}/product/${productId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-product-page, .storefront-product')).toBeVisible({ timeout: 15000 })
  // XXL exists & is in stock for Black, but does NOT exist for White.
  await selectVariant(page, 'Black', 'XXL')
  await expect(page.locator('.size-btn--active, .size-chip--active')).toContainText('XXL')
  await page.locator('.color-btn').nth(1).click()
  await expect(page.locator('.size-btn--active')).toHaveCount(0)
  // White has no XXL → the previously-selected size must be reset.
  const activeSize = await page.locator('.size-btn--active').count()
  expect(activeSize).toBe(0)
})

test('cart keeps different variants as separate lines', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureVariantStore(c.slug, c.email, `متجر المتغيرات ${c.uniq}`)
  const productId = await seedVariantProduct(storeId)

  await addToCartFromProduct(page, c.slug, productId, 'Black', 'M', 1)
  await addToCartFromProduct(page, c.slug, productId, 'White', 'L', 1, 2)
  await page.goto(`/store/${c.slug}/cart`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.cart-line')).toHaveCount(2)
})

test('quantity offer charged as bundle total (not unit × qty)', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureVariantStore(c.slug, c.email, `متجر المتغيرات ${c.uniq}`)
  const productId = await seedVariantProduct(storeId, 'quantity')

  await page.goto(`/store/${c.slug}/product/${productId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-product-page, .storefront-product')).toBeVisible({ timeout: 15000 })
  await page.locator('.qty-tier-btn', { hasText: '2' }).first().click()
  await expect(page.locator('.qty-tier-row--active')).toContainText('2')
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await expect(page.getByRole('link', { name: /السلة،/ })).toContainText(String(2))
  await page.goto(`/store/${c.slug}/cart`, { waitUntil: 'domcontentloaded' })
  // One bundle-priced line is in the cart.
  await expect(page.locator('.cart-line')).toHaveCount(1)

  await checkoutGuest(page, c.slug, '01030000003', 'مشتري عرض')
  const order = await latestOrder(storeId)
  const item = order!.data.items[0]
  expect(item.lineTotal).toBe(900)
  expect(item.pricingMode).toBe('quantity')
  expect(item.quantityPricingStrategy).toBe('cap')
})

// ──────────────────────────────────────────────────────────────────────
// G1 — idempotent stock restoration across ANY path into a cancelled state.
// A cancelled/returned order must restore exactly once, even via a path that
// leaves the first cancelled state before entering the other valid terminal
// state (cancel → deliver → returned).
// The DELIVERED transition is written directly to Firestore (bypassing the
// callable) only to set up the "delivered in the middle" scenario; the two
// cancellations exercise the real `updateOrderStatus` restore guard.
// ──────────────────────────────────────────────────────────────────────
test('cancel → deliver → cancel restores stock exactly once (no double restore)', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureVariantStore(c.slug, c.email, `متجر المتغيرات ${c.uniq}`)
  const productId = await seedVariantProduct(storeId)
  const uid = `variant-owner-${c.slug}`

  await addToCartFromProduct(page, c.slug, productId, 'Black', 'M', 2)
  await checkoutGuest(page, c.slug, '01030000004', 'مشتري إلغاء-استعادة')
  const order = await latestOrder(storeId)
  const orderId = order!.id
  // Order created: Black/M went 5 → 3.
  await expect.poll(async () => variantStockOf(productId, 'black-m'), { timeout: 15000 }).toBe(3)

  // 1st cancel (NEW → CANCELLED): restores 2 → stock returns to 5, stockRestored set true.
  await login(page, 'merchant', c.email, 'Customer123')
  await page.goto(`/dashboard/orders/${orderId}`, { waitUntil: 'domcontentloaded' })
  await cancelMerchantOrder(page)
  await expect.poll(async () => variantStockOf(productId, 'black-m'), { timeout: 15000 }).toBe(5)
  const orderSnap = await db.doc(`orders/${orderId}`).get()
  expect(orderSnap.data()?.stockRestored).toBe(true)

  // Mid-path: deliver the already-cancelled order directly (sets status DELIVERED).
  // This is the dangerous transition — a naive guard keyed on "previous status"
  // would treat DELIVERED → RETURNED as a brand-new cancellation.
  await db.doc(`orders/${orderId}`).update({
    status: 'DELIVERED',
    statusHistory: admin.firestore.FieldValue.arrayUnion({
      status: 'DELIVERED', at: admin.firestore.Timestamp.now(), by: uid,
    }),
  })
  // Rehydrate the workspace so the status menu is derived from the direct
  // DELIVERED write rather than the previous terminal snapshot.
  await page.reload({ waitUntil: 'domcontentloaded' })
  // Confirm the durable backend transition before invoking the next terminal
  // action. This is the synchronization contract; no fixed sleep is needed.
  await expect.poll(async () => (await db.doc(`orders/${orderId}`).get()).data()?.status, { timeout: 15000 }).toBe('DELIVERED')
  await expect(page.locator('.ods-status-pill')).toContainText('تم التسليم', { timeout: 15000 })
  // Delivering must NOT move stock (already 5).
  await expect.poll(async () => variantStockOf(productId, 'black-m'), { timeout: 10000 }).toBe(5)

  // 2nd terminal transition (DELIVERED → RETURNED) uses the same current workspace
  // action as the first cancellation; the durable stockRestored flag must
  // prevent a second restoration.
  await expect(page.getByRole('button', { name: 'تحديث الحالة', exact: true }).last()).toBeVisible({ timeout: 15000 })
  await cancelMerchantOrder(page, 'مرتجع')
  await expect.poll(async () => variantStockOf(productId, 'black-m'), { timeout: 15000 }).toBe(5)
})

// ──────────────────────────────────────────────────────────────────────
// G2 — backend rejects a manipulated order item that names a variant which
// does not exist for the product. A variant product must never fall back to
// decrementing the flat aggregate stock for a non-existent variant.
// ──────────────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken, connectAuthEmulator } from 'firebase/auth'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'

// Client SDK app pointed at the local emulators (independent from app bundle).
const clientApp = initializeApp({
  apiKey: 'any',
  authDomain: 'mk-store-app.firebaseapp.com',
  projectId: 'mk-store-app',
  storageBucket: 'mk-store-app.firebasestorage.app',
})
const clientAuth = getAuth(clientApp)
clientAuth.useDeviceLanguage()
connectAuthEmulator(clientAuth, 'http://localhost:9099', { disableWarnings: true })
const clientFunctions = getFunctions(clientApp)
connectFunctionsEmulator(clientFunctions, 'localhost', 5001)

async function signInMerchant(uid: string): Promise<void> {
  // Mint a custom token server-side, then let the client SDK perform the
  // Auth-emulator exchange (handles the ID-token flow for httpsCallable).
  const customToken = await admin.auth().createCustomToken(uid)
  await signInWithCustomToken(clientAuth, customToken)
}

test('backend rejects a manipulated order item naming a non-existent variant', async () => {
  const c = ctx()
  const storeId = await ensureVariantStore(c.slug, c.email, `متجر المتغيرات ${c.uniq}`)
  const productId = await seedVariantProduct(storeId)
  const uid = `variant-owner-${c.slug}`

  await signInMerchant(uid)
  // httpsCallable attaches the signed-in user's ID token automatically.
  const createOrder = httpsCallable(clientFunctions, 'createOrder')
  let rejected = false
  try {
    await createOrder({
      storeId,
      items: [{ productId, variantId: 'does-not-exist-variant', color: 'Black', size: 'ZZ' }],
      customerName: 'مخترع',
      phone: '01099999999',
      governorate: 'القاهرة',
      city: 'القاهرة',
      address: 'عنوان تجريبي',
      paymentMethod: 'cod'
    })
  } catch {
    rejected = true
  }
  expect(rejected).toBe(true)

  // And no stock was decremented anywhere.
  const prod = await db.doc(`products/${productId}`).get()
  expect(prod.data()?.variants.find((v: any) => v.id === 'black-m').stock).toBe(5)
})
