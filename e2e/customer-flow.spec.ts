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

// Unique suffix per process run so re-runs on a persistent emulator never
// collide on signup emails (the store/merchant are idempotent by slug).
const RUN = Date.now().toString(36)

// ─────────────────────────────────────────────────────────────
// Per-project identity (desktop / mobile-*) like the other suites.
// ─────────────────────────────────────────────────────────────
function ctx() {
  const p = test.info().project.name
  const uniq = p === 'desktop' ? 'desktop' : `m${p.replace('mobile-', '')}`
  return {
    uniq,
    slug: `customer-flow-${uniq}`,
    email: `customer-owner-${uniq}@mk.test`,
    secondSlug: `customer-flow-b-${uniq}`,
    secondEmail: `customer-owner-b-${uniq}@mk.test`,
  }
}

async function storeBySlug(slug: string) {
  const snap = await db.collection('stores').where('slug', '==', slug).get()
  return snap.empty ? null : snap.docs[0]
}

// Creates (idempotently) a dedicated published store + merchant + product +
// active subscription per project so this suite never mutates seeded numbers.
async function ensureStore(slug: string, email: string, name: string) {
  const existing = await storeBySlug(slug)
  if (existing) {
    // Keep the dedicated product flat (no variants) so checkout stays simple,
    // even when this store was created by an earlier run of the suite.
    const prods = await db.collection('products').where('storeId', '==', existing.id).get()
    for (const doc of prods.docs) {
      await doc.ref.update({ variants: [], colors: [], sizes: [], stock: 50, active: true })
    }
    if (prods.empty) {
      const prod = db.collection('products').doc()
      await prod.set({
        id: prod.id, storeId: existing.id, name: 'منتج اختبار التدفق', price: 240, oldPrice: 300,
        description: 'منتج تجريبي', images: [], stock: 50, variants: [], colors: [], sizes: [],
        active: true, featured: true, lowStockThreshold: 5,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'customer-flow-spec',
      })
    }
    return existing.id
  }

  const uid = `customer-owner-${slug}`
  await admin.auth().createUser({ uid, email, password: 'Customer123', displayName: 'مالك التدفق' }).catch(() => {})
  await db.collection('users').doc(uid).set({
    uid, email, name: 'مالك التدفق', role: 'merchant', storeIds: [uid], active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'customer-flow-spec',
  })
  await db.collection('stores').doc(uid).set({
    ref: slug, name, slug, active: true, published: true, ownerId: uid,
    currency: 'EGP', description: 'متجر مخصص لاختبارات تدفق العميل',
    theme: { primary: '#16a34a', secondary: '#f59e0b', darkMode: false },
    seoTitle: name, seoDescription: 'متجر مخصص لاختبارات تدفق العميل',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'customer-flow-spec',
  })
  await db.collection('subscriptions').add({
    storeId: uid, planId: 'plan-growth', planName: 'النمو', status: 'active', ordersUsed: 0,
    currentPeriodStart: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000 * 5)),
    currentPeriodEnd: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000 * 25)),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'customer-flow-spec',
  })
  const prod = db.collection('products').doc()
  await prod.set({
    id: prod.id, storeId: uid, name: 'منتج اختبار التدفق', price: 240, oldPrice: 300, description: 'منتج تجريبي',
    images: [], stock: 50, variants: [], colors: [], sizes: [], active: true, featured: true, lowStockThreshold: 5,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'customer-flow-spec',
  })
  return uid
}

async function login(page: Page, role: 'platform' | 'merchant', email: string, password: string) {
  await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  const emailInput = page.locator('input[type="email"]')
  const pendingHeading = page.getByText('الحساب قيد المراجعة', { exact: false })
  const dashboardShell = page.locator('.sidebar-logout:visible').first()
  await expect.poll(async () => (
    (await emailInput.count()) > 0 || (await pendingHeading.count()) > 0 || (await dashboardShell.count()) > 0
  ), { timeout: 15000 }).toBe(true)
  if ((await page.locator('button[type="submit"]').count()) === 0) {
    const logout = page.locator('.sidebar-logout:visible').first()
    if ((await logout.count()) === 0) {
      await page.locator('.sidebar-toggle:visible').first().click()
    }
    await page.locator('.sidebar-logout:visible').first().click()
    await page.waitForURL(/\/login/, { timeout: 15000 })
    await page.waitForLoadState('domcontentloaded')
    await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  }
  await expect(emailInput).toBeVisible({ timeout: 15000 })
  await emailInput.fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/dashboard|\/platform/, { timeout: 15000 })
}

async function setMerchantOrderStatus(page: Page, label: string, orderId?: string) {
  // Rehydrate after each callable mutation so the next menu is derived from
  // the confirmed server state, not a live-listener render in flight.
  await page.reload({ waitUntil: 'domcontentloaded' })
  const mobile = await page.evaluate(() => window.innerWidth < 768)
  const update = mobile
    ? page.getByRole('button', { name: 'تحديث الحالة', exact: true }).last()
    : page.getByRole('button', { name: 'تحديث الحالة', exact: true }).first()
  await expect(update).toBeVisible({ timeout: 15000 })
  await update.click({ force: true })
  if (mobile) await expect(page.locator('.ods-sheet-backdrop')).toBeVisible({ timeout: 5000 })
  const menu = mobile ? page.locator('.ods-sheet .ods-status-menu') : page.locator('.ods-status-dropdown .ods-status-menu')
  // A realtime order snapshot can replace the workspace between the click and
  // the menu render. Re-open only when the deterministic menu state is still
  // absent; no time-based sleep is used.
  try {
    await expect(menu).toBeVisible({ timeout: 1500 })
  } catch {
    await update.click({ force: true })
    await expect(menu).toBeVisible({ timeout: 5000 })
  }
  const confirm = page.getByRole('button', { name: 'تأكيد التحديث', exact: true })
  await menu.getByRole('button').filter({ hasText: label }).last().click()
  // A Firestore snapshot may replace the open workspace at the exact moment
  // the option is clicked. Retry the user action against the current DOM
  // instead of forcing a detached/stale button.
  if (!(await confirm.isVisible().catch(() => false))) {
    await update.click()
    await expect(menu).toBeVisible({ timeout: 5000 })
    await menu.getByRole('button').filter({ hasText: label }).last().click()
  }
  await expect(confirm).toBeVisible({ timeout: 5000 })
  const statusPromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().includes('/updateOrderStatus'),
  )
  await confirm.click()
  const statusResponse = await statusPromise
  if (!statusResponse.ok()) {
    const body = await statusResponse.text().catch(() => '')
    throw new Error(`updateOrderStatus failed: HTTP ${statusResponse.status()} ${body}`)
  }
  await expect(page.locator('.ods-confirm-backdrop')).toHaveCount(0, { timeout: 10000 })
  if (orderId) {
    const expected = Object.entries({ 'تم التواصل': 'CONTACTED', 'قيد التجهيز': 'PROCESSING', 'تم الشحن': 'SHIPPED', 'تم التسليم': 'DELIVERED' })
      .find(([text]) => text === label)?.[1]
    if (expected) await expect.poll(async () => (await db.doc(`orders/${orderId}`).get()).data()?.status, { timeout: 15000 }).toBe(expected)
  }
  await expect(page.locator('.ods-status-pill')).toContainText(label, { timeout: 15000 })
}

// Select a variant if the store product uses one.
async function pickFirstVariant(page: Page) {
  if (await page.locator('.color-btn').count()) await page.locator('.color-btn').first().click()
  if (await page.locator('.size-btn:not(.size-btn--disabled)').count()) await page.locator('.size-btn:not(.size-btn--disabled)').first().click()
}

// Buy one product as the current session and return the order number.
async function guestCheckout(page: Page, slug: string, phone: string, name: string) {
  await page.goto(`/store/${slug}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.store-card').first().click()
  await page.waitForURL(/\/product\//, { timeout: 15000 })
  await pickFirstVariant(page)
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${slug}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()
  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill(name)
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill(phone)
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'القاهرة' })
  await page.getByLabel('المدينة').selectOption({ label: 'مدينة نصر' })
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع تجريبي ١')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })
  const orderNumber = (await page.locator('.order-confirmed .monospace').first().textContent())?.trim() || ''
  expect(orderNumber).toMatch(/^ORD-\d{5}$/)
  return orderNumber
}

async function latestOrderNumber(storeId: string) {
  const snap = await db.collection('orders').where('storeId', '==', storeId).orderBy('createdAt', 'desc').limit(1).get()
  return snap.empty ? null : { id: snap.docs[0].id, data: snap.docs[0].data() as any }
}

test.describe.configure({ mode: 'serial' })

test('guest checkout confirms order + shows tracking hint and optional account CTA', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureStore(c.slug, c.email, `متجر تدفق العميل ${c.uniq}`)
  const orderNumber = await guestCheckout(page, c.slug, '01020000001', 'ضيف تدفق')

  await expect(page.getByText('احتفظ بهذا الكود؛ ستحتاجه للتتبع، وهو المرجع الذي يُرسل لشركة الشحن عند إنشاء الشحنة.')).toBeVisible()
  await expect(page.getByText('تابع طلباتك من مكان واحد')).toBeVisible()

  // Order persisted server-side, as a guest, with a customer doc (type guest).
  const snap = await db.collection('orders').where('storeId', '==', storeId).where('orderNumber', '==', orderNumber).get()
  expect(snap.size).toBe(1)
  const order = snap.docs[0].data() as any
  expect(order.customerType).toBe('guest')
  expect(order.customerId).toBeNull()

  const custSnap = await db.collection('customers').where('storeId', '==', storeId).where('phone', '==', '01020000001').get()
  expect(custSnap.empty).toBe(false)
  expect(custSnap.docs[0].data()!.type).toBe('guest')
  expect(custSnap.docs[0].id).toBe(order.customerDocId)
})

test('guest tracks order with order number + phone (correct pair allowed)', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureStore(c.slug, c.email, `متجر تدفق العميل ${c.uniq}`)
  const latest = await latestOrderNumber(storeId)
  expect(latest).not.toBeNull()
  await page.goto(`/store/${c.slug}/track`, { waitUntil: 'domcontentloaded' })
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01020000001')
  await page.getByLabel('كود الطلب').fill(latest!.data.orderNumber)
  await page.getByRole('button', { name: 'تتبع الطلب' }).click()
  await expect(page.getByText('جديد').first()).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.order-steps')).toBeVisible()
})

test('guest tracking: wrong phone is denied', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureStore(c.slug, c.email, `متجر تدفق العميل ${c.uniq}`)
  const latest = await latestOrderNumber(storeId)
  expect(latest).not.toBeNull()
  await page.goto(`/store/${c.slug}/track`, { waitUntil: 'domcontentloaded' })
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01099999999')
  await page.getByLabel('كود الطلب').fill(latest!.data.orderNumber)
  await page.getByRole('button', { name: 'تتبع الطلب' }).click()
  await expect(page.getByText('لا توجد طلبات مطابقة لهذه البيانات.')).toBeVisible({ timeout: 15000 })
})

test('guest tracking: wrong order number is denied', async ({ page }) => {
  const c = ctx()
  await ensureStore(c.slug, c.email, `متجر تدفق العميل ${c.uniq}`)
  await page.goto(`/store/${c.slug}/track`, { waitUntil: 'domcontentloaded' })
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01020000001')
  await page.getByLabel('كود الطلب').fill('ORD-99999')
  await page.getByRole('button', { name: 'تتبع الطلب' }).click()
  await expect(page.getByText('لا توجد طلبات مطابقة لهذه البيانات.')).toBeVisible({ timeout: 15000 })
})

test('registered customer checkout links the order to the account', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureStore(c.slug, c.email, `متجر تدفق العميل ${c.uniq}`)

  // Create a customer account first (no claim — plain signup).
  await page.goto(`/store/${c.slug}/login?mode=signup`, { waitUntil: 'domcontentloaded' })
  await page.locator('.auth-field', { hasText: 'الاسم بالكامل' }).locator('input').fill('عميل مسجل')
  await page.locator('.auth-field', { hasText: 'البريد الإلكتروني' }).locator('input').fill(`reg-${RUN}-${c.uniq}@mk.test`)
  await page.locator('input[type="password"]').fill('Pass12345')
  await page.locator('.auth-field', { hasText: 'رقم الهاتف' }).locator('input').fill('01020000002')
  await page.locator('.checkbox-label input[type="checkbox"]').check()
  await page.locator('form.auth-form').getByRole('button', { name: 'إنشاء حساب', exact: true }).click()
  await page.waitForURL(/\/account/, { timeout: 15000 })

  const uid = (await admin.auth().getUserByEmail(`reg-${RUN}-${c.uniq}@mk.test`)).uid

  // Place an order while signed in.
  await page.goto(`/store/${c.slug}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.store-card').first().click()
  await page.waitForURL(/\/product\//, { timeout: 15000 })
  await pickFirstVariant(page)
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${c.slug}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()
  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل مسجل')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01020000002')
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'القاهرة' })
  await page.getByLabel('المدينة').selectOption({ label: 'مدينة نصر' })
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع ٢')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })

  const latest = await latestOrderNumber(storeId)
  expect(latest).not.toBeNull()
  expect(latest!.data.customerType).toBe('registered')
  expect(latest!.data.customerId).toBe(uid)
})

test('My Orders lists the registered order and Order Details render full data + timeline', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureStore(c.slug, c.email, `متجر تدفق العميل ${c.uniq}`)

  await page.goto(`/store/${c.slug}/login?mode=signup`, { waitUntil: 'domcontentloaded' })
  await page.locator('.auth-field', { hasText: 'الاسم بالكامل' }).locator('input').fill('عميل موسع')
  await page.locator('input[type="password"]').fill('Pass12345')
  await page.locator('.auth-field', { hasText: 'البريد الإلكتروني' }).locator('input').fill(`detail-${RUN}-${c.uniq}@mk.test`)
  await page.locator('.auth-field', { hasText: 'رقم الهاتف' }).locator('input').fill('01020000003')
  await page.locator('.checkbox-label input[type="checkbox"]').check()
  await page.locator('form.auth-form').getByRole('button', { name: 'إنشاء حساب', exact: true }).click()
  await page.waitForURL(/\/account/, { timeout: 15000 })

  await page.goto(`/store/${c.slug}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.store-card').first().click()
  await page.waitForURL(/\/product\//, { timeout: 15000 })
  await pickFirstVariant(page)
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${c.slug}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()
  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل موسع')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01020000003')
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'القاهرة' })
  await page.getByLabel('المدينة').selectOption({ label: 'مدينة نصر' })
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع ٣')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })
  const orderNumber = (await page.locator('.order-confirmed .monospace').first().textContent())?.trim() || ''

  // My Orders shows it.
  await page.goto(`/store/${c.slug}/account`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(orderNumber)).toBeVisible({ timeout: 15000 })

  // Open details and assert full breakdown + real timeline.
  await page.getByText(orderNumber).first().click()
  await page.waitForURL(/\/orders\//, { timeout: 15000 })
  await expect(page.locator('.order-steps')).toBeVisible()
  await expect(page.getByText('جديد').first()).toBeVisible()
  await expect(page.getByText('منتج اختبار التدفق')).toBeVisible()
  await expect(page.getByText('المجموع الفرعي')).toBeVisible()
  await expect(page.locator('.summary-row', { hasText: 'الشحن' })).toBeVisible()
  await expect(page.locator('.summary-row', { hasText: 'الإجمالي' })).toBeVisible()

  const order = (await db.collection('orders').where('storeId', '==', storeId).where('orderNumber', '==', orderNumber).get()).docs[0].data() as any
  expect(Array.isArray(order.statusHistory)).toBe(true)
  expect(order.statusHistory[0].status).toBe('NEW')
})

test('guest -> registered: claimOrder links the order without a duplicate', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureStore(c.slug, c.email, `متجر تدفق العميل ${c.uniq}`)
  const orderNumber = await guestCheckout(page, c.slug, '01020000004', 'ضيف يحوّل')

  const before = await db.collection('orders').where('storeId', '==', storeId).where('orderNumber', '==', orderNumber).get()
  expect(before.size).toBe(1)
  const orderId = before.docs[0].id

  // Guest clicks "إنشاء حساب" -> signup form prefilled with the order + phone.
  await page.getByRole('button', { name: 'إنشاء حساب' }).click()
  await page.waitForURL(/\/login\?mode=signup/, { timeout: 15000 })

  await page.locator('.auth-field', { hasText: 'الاسم بالكامل' }).locator('input').fill('عميل بعد التحويل')
  await page.locator('.auth-field', { hasText: 'البريد الإلكتروني' }).locator('input').fill(`claim-${RUN}-${c.uniq}@mk.test`)
  await page.locator('input[type="password"]').fill('Pass12345')
  await page.locator('.auth-field', { hasText: 'رقم الهاتف' }).locator('input').fill('01020000004')
  await page.locator('.checkbox-label input[type="checkbox"]').check()
  await page.locator('form.auth-form').getByRole('button', { name: 'إنشاء حساب', exact: true }).click()

  const uid = (await admin.auth().getUserByEmail(`claim-${RUN}-${c.uniq}@mk.test`)).uid

  // Order is now linked to the account (no new order was created).
  await expect
    .poll(async () => (await db.doc(`orders/${orderId}`).get()).data()?.customerId, { timeout: 15000 })
    .toBe(uid)

  const after = await db.collection('orders').where('storeId', '==', storeId).where('orderNumber', '==', orderNumber).get()
  expect(after.size).toBe(1)
  expect(after.docs[0].id).toBe(orderId)
  expect((after.docs[0].data() as any).customerType).toBe('registered')

  // It appears in My Orders.
  await page.waitForURL(/\/account/, { timeout: 15000 })
  await expect(page.getByText(orderNumber)).toBeVisible({ timeout: 15000 })

  // Customer doc is now registered + linked to the account.
  const custSnap = await db.collection('customers').where('storeId', '==', storeId).where('phone', '==', '01020000004').get()
  expect(custSnap.empty).toBe(false)
  expect(custSnap.docs[0].data()!.type).toBe('registered')
  expect(custSnap.docs[0].data()!.userId).toBe(uid)
})

test('real status update from the merchant is reflected in guest tracking', async ({ page }) => {
  const c = ctx()
  const storeId = await ensureStore(c.slug, c.email, `متجر تدفق العميل ${c.uniq}`)
  // Keep this order isolated even when an emulator is reused without a full
  // wipe. The order number counter is store-scoped, so an older fixture with
  // the same number must never be selected for the lifecycle assertion.
  const statusPhone = `010${c.uniq === 'desktop' ? '9' : '8'}${String(Date.now() % 10_000_000).padStart(7, '0')}`
  const orderNumber = await guestCheckout(page, c.slug, statusPhone, 'ضيف الحالة')

  // Resolve the exact order returned by this checkout. Ordering by a server
  // timestamp is not deterministic when multiple emulator writes share the
  // same millisecond, and can select an older order already at SHIPPED.
  const created = await db.collection('orders')
    .where('storeId', '==', storeId)
    .where('orderNumber', '==', orderNumber)
    .where('phone', '==', statusPhone)
    .limit(1)
    .get()
  expect(created.size).toBe(1)
  const orderId = created.docs[0].id
  expect(created.docs[0].data()?.status).toBe('NEW')

  // The backend enforces the order state machine; advance through the valid
  // lifecycle rather than attempting an illegal NEW -> DELIVERED jump.
  await login(page, 'merchant', c.email, 'Customer123')
  await page.goto(`/dashboard/orders/${orderId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(new RegExp(`/dashboard/orders/${orderId}$`), { timeout: 15000 })
  await expect(page.locator('.ods-timeline')).toBeVisible({ timeout: 15000 })
  for (const next of ['تم التواصل', 'قيد التجهيز', 'تم الشحن', 'تم التسليم']) {
    await setMerchantOrderStatus(page, next, orderId)
  }
  await expect.poll(async () => (await db.doc(`orders/${orderId}`).get()).data()?.status, { timeout: 15000 }).toBe('DELIVERED')

  // Guest re-tracks and sees the real updated status + timeline.
  await page.goto(`/store/${c.slug}/track`, { waitUntil: 'domcontentloaded' })
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill(statusPhone)
  await page.getByLabel('كود الطلب').fill(orderNumber)
  await page.getByRole('button', { name: 'تتبع الطلب' }).click()
  await expect(page.getByText('تم التسليم', { exact: true }).first()).toBeVisible({ timeout: 15000 })
  const order = (await db.doc(`orders/${orderId}`).get()).data() as any
  expect(order.statusHistory.some((h: any) => h.status === 'DELIVERED')).toBe(true)
})

test('store isolation: order of store A cannot be tracked through store B context', async ({ page }) => {
  const c = ctx()
  const storeA = await ensureStore(c.slug, c.email, `متجر تدفق تابع ${c.uniq}`)
  await ensureStore(c.secondSlug, c.secondEmail, `متجر تدفق مخالف ${c.uniq}`)

  // Order in store A.
  await guestCheckout(page, c.slug, '01020000006', 'عميل عزل أ')
  const latestA = await latestOrderNumber(storeA)
  expect(latestA).not.toBeNull()

  // Trying to track that exact order through store B's context is denied.
  await page.goto(`/store/${c.secondSlug}/track`, { waitUntil: 'domcontentloaded' })
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01020000006')
  await page.getByLabel('كود الطلب').fill(latestA!.data.orderNumber)
  await page.getByRole('button', { name: 'تتبع الطلب' }).click()
  await expect(page.getByText('لا توجد طلبات مطابقة لهذه البيانات.')).toBeVisible({ timeout: 15000 })
})

test('merchant isolation: owner of store A cannot read store B orders or customers', async ({ page }) => {
  const c = ctx()
  await ensureStore(c.slug, c.email, `متجر تدفق تابع ${c.uniq}`)
  const storeB = await ensureStore(c.secondSlug, c.secondEmail, `متجر تدفق مخالف ${c.uniq}`)

  // Seed a customer + order directly into store B (not reachable from store A).
  await db.collection('customers').add({
    storeId: storeB, name: 'عميل ب', phone: '01099900001', segment: null, totalOrders: 1, totalSpent: 100,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  const orderBRef = await db.collection('orders').add({
    storeId: storeB, orderNumber: 'ORD-00087', customerName: 'عميل ب', phone: '01099900001',
    governorate: 'القاهرة', city: 'مدينة نصر', address: 'شارع ب', customerId: null,
    items: [{ id: 'x-', productId: 'x', name: 'منتج ب', price: 100, quantity: 1 }],
    subtotal: 100, shippingFee: 0, discount: 0, totalPrice: 100, status: 'NEW',
    paymentMethod: 'cod', couponCode: null, trackingCode: null,
    statusHistory: [{ status: 'NEW', at: admin.firestore.Timestamp.now() }],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  // Login as merchant A.
  await login(page, 'merchant', c.email, 'Customer123')

  // A's orders list never shows store B's order number.
  await page.goto('/dashboard/orders', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('ORD-00087').first()).toHaveCount(0, { timeout: 15000 })

  // A cannot fetch store B's order details (rules deny) — page shows not-found.
  await page.goto(`/dashboard/orders/${orderBRef.id}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('الطلب غير موجود')).toBeVisible({ timeout: 15000 })

  // A's customers list only contains store A customers, never store B's.
  await page.goto('/dashboard/customers', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('عميل ب').first()).toHaveCount(0, { timeout: 15000 })
})
