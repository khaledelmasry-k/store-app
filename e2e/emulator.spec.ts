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
  // The auth guard redirects an already-authenticated session away from /login
  // after hydration. If the login form never renders, sign out and retry.
  await page.waitForTimeout(600)
  if ((await page.locator('button[type="submit"]').count()) === 0) {
    await page.locator('.user-chip').first().click()
    await page.getByText('تسجيل الخروج').first().click()
    await page.waitForURL(/\/login/, { timeout: 15000 })
    await page.waitForLoadState('domcontentloaded')
    await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  }
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

function phoneFromEmail(email: string) {
  const raw = email.replace(/[^a-z0-9]/gi, '')
  let h = 0
  for (const c of raw) h = (h * 31 + c.charCodeAt(0)) % 100000000
  return `01${String(h).padStart(8, '0')}`
}

async function registerStore(
  page: Page,
  opts: { email: string; password: string; name: string; storeName: string; storeRef: string; planName: string },
) {
  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await page.locator('.auth-card input[type="email"]').fill(opts.email)
  await page.locator('.auth-card input[type="password"]').fill(opts.password)
  await page.locator('.auth-card input').nth(0).fill(opts.name)
  await page.locator('.auth-card input').nth(1).fill(phoneFromEmail(opts.email))
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.locator('.plan-card', { hasText: opts.planName }).click()
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.locator('.auth-card input').nth(0).fill(opts.storeName)
  await page.locator('.auth-card input').nth(1).fill(opts.storeRef)
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
  await expect(page.getByText('تم إنشاء حسابك بنجاح')).toBeVisible({ timeout: 30000 })
}

async function merchantRow(page: Page, text: string) {
  const base = page.locator('tr, .card-table-card')
  for (let p = 0; p < 5; p++) {
    const row = base.filter({ hasText: text }).first()
    if ((await row.count()) > 0) return row
    const next = page.locator('button', { hasText: 'التالي' })
    if ((await next.count()) === 0 || (await next.isDisabled())) break
    await next.click()
    await page.waitForTimeout(300)
  }
  return base.filter({ hasText: text }).first()
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

// 1x1 transparent PNG (same fixture as products.spec).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
function ctx() {
  const p = test.info().project.name
  const uniq = p === 'desktop' ? 'desktop' : `m${p.replace('mobile-', '')}`
  return { uniq, email: `flow-${uniq}@mk.test`, ref: `flow-${uniq}`, storeName: `مقهى التدفق ${uniq}` }
}

// ─────────────────────────────────────────────────────────────
test('register new merchant (published=false, trialing) + slug created', async ({ page }) => {
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
  expect(sub!.status).toBe('trialing')
  expect(sub!.planId).toBe('plan-starter')
  expect(sub!.trialEndsAt).toBeTruthy()
  expect(sub!.normalPriceSnapshot).toBe(299)
  expect(sub!.launchPriceSnapshot).toBe(99)
  expect(sub!.launchUsed).toBeFalsy()
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

test('trial merchant self-serves: publish + theme + product', async ({ page }) => {
  const { email, ref } = ctx()
  const store = (await pollValue(() => storeBySlug(ref), (s) => s != null))!

  // Merchant account is active immediately (instant trial — no admin approval).
  await login(page, 'merchant', email, PASSWORD)
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })

  // Publish from the dashboard toggle (trialing grant allows it).
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.checklist')).toBeVisible({ timeout: 15000 })
  await page.locator('.toggle').click()
  await expect.poll(() => storeBySlug(ref).then((s) => s?.data()?.published), { timeout: 15000 }).toBe(true)

  // Theme the store on the new Appearance page (auto-saves after debounce).
  await page.goto('/dashboard/themes', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.theme-gallery')).toBeVisible({ timeout: 15000 })

  // Apply the "minimal" template and confirm it persists to Firestore.
  await page.locator('.theme-card', { hasText: 'مينيمال' }).getByRole('button', { name: 'تطبيق' }).click()
  await expect
    .poll(() => storeBySlug(ref).then((s) => s?.data()?.theme?.template), { timeout: 15000 })
    .toBe('minimal')
  await expect(page.locator('.theme-card--active')).toContainText('القالب الحالي')

  // Override colors with the swatches (template default colors get replaced).
  await page.locator('.swatch[title="#16a34a"]').first().click()
  await expect
    .poll(() => storeBySlug(ref).then((s) => s?.data()?.theme?.primary), { timeout: 15000 })
    .toBe('#16a34a')
  await page.locator('.swatch[title="#f59e0b"]').first().click()
  await expect
    .poll(() => storeBySlug(ref).then((s) => s?.data()?.theme?.secondary), { timeout: 15000 })
    .toBe('#f59e0b')

  // Add a product via the products drawer.
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'منتج جديد' }).click()
  await page.locator('.field', { hasText: 'اسم المنتج' }).locator('input').fill('بن التدفق المختص')
  await page.locator('.drawer input[type="number"]').nth(0).fill('240')
  await page.locator('.drawer input[type="number"]').nth(1).fill('300')
  await page.locator('.drawer input[type="number"]').nth(2).fill('10')
  await page.getByRole('button', { name: 'حفظ المنتج' }).click()
  await expect.poll(() => countProducts(store.id), { timeout: 15000 }).toBe(1)

  // Theme survives a full logout → login cycle (persisted server-side, not in frontend state).
  await logout(page)
  await login(page, 'merchant', email, PASSWORD)
  await page.goto('/dashboard/themes', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.theme-card--active')).toContainText('مينيمال', { timeout: 15000 })
  await expect
    .poll(() => storeBySlug(ref).then((s) => s?.data()?.theme?.template), { timeout: 15000 })
    .toBe('minimal')
  await expect
    .poll(() => storeBySlug(ref).then((s) => s?.data()?.theme?.primary), { timeout: 15000 })
    .toBe('#16a34a')

  // Tenant isolation: another merchant's storefront never inherits this store's theme.
  await page.goto('/store/active-shoes', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-shell.theme-minimal')).toHaveCount(0, { timeout: 15000 })
  await expect
    .poll(() => storeBySlug('active-shoes').then((s) => s?.data()?.theme?.template || 'modern'), { timeout: 15000 })
    .toBe('modern')
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

  // Template class applied on the store shell (applied earlier on Appearance page).
  await expect(page.locator('.store-shell.theme-minimal')).toHaveCount(1, { timeout: 15000 })

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

  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })
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
  await page.goto('/store/amal-kids', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-coming-soon')).toBeVisible({ timeout: 15000 })
  await shot(page, `coming-soon-${uniq}`)

  // Owner (seeded store E) can preview the storefront.
  await login(page, 'merchant', 'owner@e.store', 'Owner12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto('/store/amal-kids', { waitUntil: 'domcontentloaded' })
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

  // Trialing + expired segments present from the seed.
  const rowC = await merchantRow(page, 'zeina-gifts')
  await expect(rowC).toContainText('تجربة مجانية')
  const rowD = await merchantRow(page, 'noor-cafe')
  await expect(rowD).toContainText('منتهي')
  const rowE = await merchantRow(page, 'amal-kids')
  await expect(rowE).toContainText('قيد الانتظار')
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

test('shipping: zones store shows zone fee at checkout and persists shippingFee + snapshot', async ({ page }) => {
  // Reuse this project's flow store (created earlier in the run) so we never
  // add an extra merchant row and overflow the platform merchants table.
  const { ref } = ctx()
  const store = (await storeBySlug(ref))!
  await db.collection('stores').doc(store.id).update({
    shipping: {
      enabled: true,
      model: 'zones',
      flatFee: 0,
      freeAbove: 800,
      refusedPolicy: 'رسوم الرفض ٦٠ جنيهاً.',
      providers: [{ id: 'p-x', name: 'شحن سريع', fee: 35, estimatedDays: '2-4 أيام', active: true }],
    },
  })
  await db.collection('shipping').add({
    storeId: store.id, name: 'القاهرة الكبرى', governorates: ['القاهرة', 'الجيزة', 'القليوبية'],
    fee: 40, freeAbove: 800, estimatedDays: '3-5 أيام', providerId: 'p-x', active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'shipping-spec',
  })

  await page.goto(`/store/${ref}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.store-card').first().click()
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${ref}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()

  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل شحن')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01099990001')

  // Pick a governorate inside the Cairo zone → fee 40 appears in the summary.
  await page
    .locator('.field', { hasText: 'المحافظة' })
    .locator('select')
    .selectOption({ label: 'القاهرة' })
  await expect(page.getByText('الشحن (القاهرة الكبرى)')).toBeVisible({ timeout: 15000 })

  await page.locator('.field', { hasText: 'المدينة' }).locator('input').fill('مدينة نصر')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع 5')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })

  const orderSnap = await db.collection('orders').where('storeId', '==', store.id).orderBy('createdAt', 'desc').limit(1).get()
  expect(orderSnap.empty).toBe(false)
  const order = orderSnap.docs[0].data() as any
  expect(order.shippingFee).toBe(40)
  expect(order.shippingMethod).toBe('القاهرة الكبرى')
  expect(order.shippingSnapshot?.enabled).toBe(true)
  expect(order.shippingSnapshot?.model).toBe('zones')
  expect(order.shippingSnapshot?.zoneId).toBeTruthy()
  expect(order.totalPrice).toBe(order.subtotal + 40)
})

test('sales link: /s/:code redirects to the storefront and DELIVERED orders count on the link', async ({ page }) => {
  // Create a dedicated link on this project's flow store, pointed at the product.
  const { uniq, ref } = ctx()
  const store = (await storeBySlug(ref))!
  const productSnap = await db.collection('products').where('storeId', '==', store.id).limit(1).get()
  const productId = productSnap.docs[0].id
  const code = `flow-${uniq}`
  const linkRef = await db.collection('storeLinks').add({
    storeId: store.id,
    code,
    name: 'رابط تدفق',
    title: 'رابط تدفق',
    sellerName: 'بائع التدفق',
    destinationType: 'product',
    destinationId: productId,
    active: true,
    archived: false,
    visits: 0,
    ordersCount: 0,
    totalRevenue: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'storelink-spec',
  })

  // Resolve /s/:code → redirected to /store/:ref/product/:id?ref=code.
  await page.goto(`/s/${code}`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(new RegExp(`/store/${ref}/product/${productId}\\?ref=${code}`), { timeout: 15000 })
  await expect(page.getByRole('button', { name: 'أضف إلى السلة' })).toBeVisible({ timeout: 15000 })

  // Visit counted exactly once per session.
  await expect.poll(async () => {
    const snap = await linkRef.get()
    return (snap.data() as any)?.visits || 0
  }, { timeout: 15000 }).toBe(1)

  // Buy via the link → the order snapshots the link.
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${ref}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()
  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل الرابط')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01099990002')
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'القاهرة' })
  await page.locator('.field', { hasText: 'المدينة' }).locator('input').fill('مدينة نصر')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع 8')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })

  const orderSnap = await db.collection('orders').where('storeId', '==', store.id).orderBy('createdAt', 'desc').limit(1).get()
  const order = orderSnap.docs[0].data() as any
  expect(order.salesLinkId).toBe(linkRef.id)
  expect(order.salesLinkRef).toBe(code)
  expect(order.salesLinkSnapshot?.code).toBe(code)
  expect(order.salesLinkSnapshot?.destinationType).toBe('product')

  // NEW order does NOT count toward the link's orders/revenue (DELIVERED-only).
  const beforeDeliver = (await linkRef.get()).data() as any
  expect(beforeDeliver.ordersCount).toBe(0)
  expect(beforeDeliver.totalRevenue).toBe(0)

  // Merchant marks the order DELIVERED via the callable → link counters increment.
  await login(page, 'merchant', ctx().email, PASSWORD)
  await page.goto(`/dashboard/orders/${orderSnap.docs[0].id}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.order-steps')).toBeVisible({ timeout: 15000 })
  await page.locator('.card select').selectOption({ label: 'تم التسليم' })
  await page.getByRole('button', { name: 'تحديث' }).click()
  await expect.poll(async () => {
    const snap = await linkRef.get()
    return { orders: (snap.data() as any)?.ordersCount || 0, rev: (snap.data() as any)?.totalRevenue || 0 }
  }, { timeout: 15000 }).toEqual({ orders: 1, rev: order.totalPrice })

  // Leaving DELIVERED (RETURNED) subtracts the revenue + order again.
  await page.locator('.card select').selectOption({ label: 'مرتجع' })
  await page.getByRole('button', { name: 'تحديث' }).click()
  await expect.poll(async () => {
    const snap = await linkRef.get()
    return { orders: (snap.data() as any)?.ordersCount || 0, rev: (snap.data() as any)?.totalRevenue || 0 }
  }, { timeout: 15000 }).toEqual({ orders: 0, rev: 0 })
})

test('landing page: /landing/:slug renders, records a view, QuickBuy orders attribute, DELIVERED counts', async ({ page }) => {
  const { uniq, ref } = ctx()
  const store = (await storeBySlug(ref))!
  const productSnap = await db.collection('products').where('storeId', '==', store.id).limit(1).get()
  const productId = productSnap.docs[0].id
  const slug = `flow-lp-${uniq}`
  const landingRef = await db.collection('landingPages').add({
    storeId: store.id,
    slug,
    title: 'صفحة تدفق',
    template: 'modern',
    status: 'published',
    active: true,
    productId,
    hero: { title: 'عرض التدفق', subtitle: 'صفحة هبوط تجريبية', image: '', ctaText: 'اطلب الآن' },
    seo: { title: 'صفحة تدفق', description: '' },
    sections: [
      { type: 'features', title: 'مميزات', body: '', items: [{ title: 'جودة', body: 'منتج ممتاز' }] },
      { type: 'faq', title: 'أسئلة', body: '', items: [{ title: 'س؟', body: 'جواب' }] },
    ],
    views: 0,
    ordersCount: 0,
    totalRevenue: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'landing-spec',
  })

  // The landing page renders standalone with the QuickBuy panel.
  await page.goto(`/landing/${slug}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'عرض التدفق' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'أضف إلى السلة' })).toBeVisible({ timeout: 15000 })

  // View recorded exactly once per session.
  await expect.poll(async () => {
    const snap = await landingRef.get()
    return (snap.data() as any)?.views || 0
  }, { timeout: 15000 }).toBe(1)

  // Buy from the QuickBuy panel → order carries landingPageId + snapshot.
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${ref}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()
  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل هبوط')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01099990003')
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'القاهرة' })
  await page.locator('.field', { hasText: 'المدينة' }).locator('input').fill('مدينة نصر')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع 9')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })

  const orderSnap = await db.collection('orders').where('storeId', '==', store.id).orderBy('createdAt', 'desc').limit(1).get()
  const order = orderSnap.docs[0].data() as any
  expect(order.landingPageId).toBe(landingRef.id)
  expect(order.landingPageSnapshot?.slug).toBe(slug)
  expect(order.landingPageSnapshot?.title).toBe('صفحة تدفق')

  // NEW order does NOT count on the landing page (DELIVERED-only).
  let lpBefore = (await landingRef.get()).data() as any
  expect(lpBefore.ordersCount).toBe(0)
  expect(lpBefore.totalRevenue).toBe(0)

  // Merchant marks DELIVERED → landing counters increment.
  await login(page, 'merchant', ctx().email, PASSWORD)
  await page.goto(`/dashboard/orders/${orderSnap.docs[0].id}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.order-steps')).toBeVisible({ timeout: 15000 })
  await page.locator('.card select').selectOption({ label: 'تم التسليم' })
  await page.getByRole('button', { name: 'تحديث' }).click()
  await expect.poll(async () => {
    const snap = await landingRef.get()
    return { orders: (snap.data() as any)?.ordersCount || 0, rev: (snap.data() as any)?.totalRevenue || 0 }
  }, { timeout: 15000 }).toEqual({ orders: 1, rev: order.totalPrice })

  // Leaving DELIVERED (RETURNED) subtracts the counters again.
  await page.locator('.card select').selectOption({ label: 'مرتجع' })
  await page.getByRole('button', { name: 'تحديث' }).click()
  await expect.poll(async () => {
    const snap = await landingRef.get()
    return { orders: (snap.data() as any)?.ordersCount || 0, rev: (snap.data() as any)?.totalRevenue || 0 }
  }, { timeout: 15000 }).toEqual({ orders: 0, rev: 0 })
})

test('all icons render as SVG glyphs (no raw icon names) — platform', async ({ page }) => {
  const assertNoRawIcons = async () => {
    await page.waitForLoadState('domcontentloaded')
    // Every mk-icon span must contain an <svg> and never paint raw text.
    const bad = await page
      .locator('.mk-icon')
      .evaluateAll((spans) =>
        spans
          .filter((s) => !s.querySelector('svg') || (s.textContent || '').trim().length > 0)
          .map((s) => ({ text: s.textContent, cls: s.className })),
      )
    expect(bad).toEqual([])
    for (const raw of [
      'signal_cellular_connected_no_internet_1_bar',
      'ular_connected_no_internet_1_bar',
      'material-symbols-outlined',
    ]) {
      expect(await page.getByText(raw).count()).toBe(0)
    }
  }

  await login(page, 'platform', 'admin@mk.store', 'Admin12345')
  await page.goto('/platform', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('قريب من الحد').first()).toBeVisible({ timeout: 15000 })
  await assertNoRawIcons()

  await page.goto('/platform/merchants', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('قريب من الحد').first()).toBeVisible({ timeout: 15000 })
  await assertNoRawIcons()
})

test('all icons render as SVG glyphs (no raw icon names) — merchant dashboard + storefront', async ({ page }) => {
  const assertNoRawIcons = async () => {
    await page.waitForLoadState('domcontentloaded')
    const bad = await page
      .locator('.mk-icon')
      .evaluateAll((spans) =>
        spans
          .filter((s) => !s.querySelector('svg') || (s.textContent || '').trim().length > 0)
          .map((s) => ({ text: s.textContent, cls: s.className })),
      )
    expect(bad).toEqual([])
    for (const raw of ['signal_cellular_connected_no_internet_1_bar', 'ular_connected_no_internet_1_bar']) {
      expect(await page.getByText(raw).count()).toBe(0)
    }
  }

  await login(page, 'merchant', 'owner@a.store', 'Owner12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await assertNoRawIcons()

  await page.goto('/store/beit-el-shay', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-header')).toBeVisible({ timeout: 15000 })
  await assertNoRawIcons()
})

test('copy-link is gated on a real slug: disabled + "غير متاح" without one, enabled with a real URL', async ({ page }) => {
  const uid = `noslug-owner-${test.info().project.name}`
  const email = `noslug-${test.info().project.name}@mk.test`
  const uniq = test.info().project.name === 'desktop' ? 'desktop' : `m${test.info().project.name.replace('mobile-', '')}`
  const ref = `noslug-${uniq}`

  await admin.auth().createUser({ uid, email, password: PASSWORD, displayName: 'بلا رابط' }).catch(() => {})
  await db.collection('users').doc(uid).set({
    uid, email, name: 'بلا رابط', role: 'merchant', storeIds: [uid], active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'store-url-spec',
  })
  await db.collection('stores').doc(uid).set({
    ref: null, name: 'متجر بلا رابط', slug: null, active: true, published: false, ownerId: uid,
    currency: 'EGP', description: 'متجر بدون slug',
    theme: { primary: '#6366f1', secondary: '#f59e0b', darkMode: false },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'store-url-spec',
  })
  await db.collection('subscriptions').add({
    storeId: uid, planId: 'plan-growth', planName: 'النمو', status: 'active', ordersUsed: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'store-url-spec',
  })

  await login(page, 'merchant', email, PASSWORD)
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })

  // Without a slug the dashboard copy button is disabled and never shows a fake URL.
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  const copyBtn = page.getByRole('button', { name: 'نسخ الرابط' }).first()
  await expect(copyBtn).toBeDisabled({ timeout: 15000 })
  await expect(copyBtn).toHaveAttribute('title', 'رابط المتجر غير متاح بعد')

  // Settings shows the clear unavailable state and a disabled copy control.
  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('لم يتم إنشاء رابط المتجر بعد').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'غير متاح' })).toBeDisabled()

  // Assign a slug via the admin SDK; the button enables and shows the real public URL.
  await db.collection('stores').doc(uid).update({ slug: ref, ref })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'غير متاح' })).toHaveCount(0, { timeout: 15000 })
  const urlText = await page.getByText(/http.*\/store\//).first().textContent()
  expect(urlText).toContain(`/store/${ref}`)
  expect(urlText).not.toContain('mystore')
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(copyBtn).toBeEnabled({ timeout: 15000 })
})

// ─────────────────────────────────────────────────────────────
// Regression suite for the production-blocker fixes:
// 1. Firestore safe-writes (underscored optional payloads no longer break saves).
// 2. Globally-unique landing slug (client create/update + duplicate derive).
// 3. Landing hero image upload persists + renders on the public page.
// 4. Shipping: refused-policy toggle gates the checkout message; store default
//    provider is honored by the client + server mirror.
// ─────────────────────────────────────────────────────────────
test('landing save with empty optional fields works; duplicate slug rejected; duplicate copies get unique slug', async ({ page }) => {
  const { uniq, ref } = ctx()
  const store = (await storeBySlug(ref))!
  const slug = `flow-reg-${uniq}`

  // The trialing flow store is on plan-starter, whose default landingPagesLimit
  // is 1 — and the earlier landing test already consumed that quota via a direct
  // admin write. Raise the seeded plan's limit so these regressions exercises the
  // callable without tripping the (already-covered separately) page-count gate.
  await db.collection('plans').doc('plan-starter').update({ landingPagesLimit: 50 })

  await login(page, 'merchant', ctx().email, PASSWORD)
  await page.goto('/dashboard/landing-pages', { waitUntil: 'domcontentloaded' })

  // Create a page with ONLY a title — productId, hero image, seo all empty/undefined.
  await page.getByRole('button', { name: 'صفحة جديدة' }).click()
  await page.locator('.drawer .field', { hasText: 'عنوان الصفحة' }).locator('input').fill('صفحة تسجيل')
  await page.locator('.drawer .field', { hasText: 'الرابط (slug)' }).locator('input').fill(slug)
  await page.locator('.drawer').getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect(page.locator('.drawer')).toHaveCount(0, { timeout: 15000 })
  await expect(page.getByText('فشل حفظ الصفحة')).toHaveCount(0)

  const saved = (await pollValue(
    () => db.collection('landingPages').where('slug', '==', slug).limit(1).get().then((s) => (s.empty ? null : s.docs[0].data() as any)),
    (d) => d != null,
  ))!
  expect(saved).not.toBeNull()
  expect(saved.title).toBe('صفحة تسجيل')
  // The undefined productId/hero fields must have been dropped without error.
  expect(saved.productId ?? null).toBeNull()

  // Creating another page with the SAME slug must be rejected client-side.
  await page.getByRole('button', { name: 'صفحة جديدة' }).click()
  await page.locator('.drawer .field', { hasText: 'عنوان الصفحة' }).locator('input').fill('صفحة موازية')
  await page.locator('.drawer .field', { hasText: 'الرابط (slug)' }).locator('input').fill(slug)
  await page.locator('.drawer').getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect(page.getByText('رابط الصفحة مستخدم مسبقاً')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.drawer')).toHaveCount(1)

  // Close the drawer, then duplicate the first page → a unique `-copy` slug.
  await page.locator('.drawer').getByRole('button', { name: 'إلغاء', exact: true }).click()
  // Desktop renders a <table>; mobile renders the same rows as `.card-table-card`
// cards — target both.
  const row = page.locator('tr, .card-table-card', { hasText: slug }).first()
  await row.getByTitle('نسخ', { exact: true }).click()
  await expect(page.getByText('تم إنشاء نسخة من الصفحة')).toBeVisible({ timeout: 15000 })
  const copySlug = `${slug}-copy`
  const copyDoc = await pollValue(
    () => db.collection('landingPages').where('slug', '==', copySlug).limit(1).get().then((s) => (s.empty ? null : s.docs[0])),
    (d) => d != null,
  )
  expect(copyDoc).not.toBeNull()
})

test('landing hero image upload persists to storage + renders on /landing/:slug', async ({ page }) => {
  const { uniq, ref } = ctx()
  const store = (await storeBySlug(ref))!
  const slug = `flow-hero-${uniq}`

  await login(page, 'merchant', ctx().email, PASSWORD)
  await page.goto('/dashboard/landing-pages', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'صفحة جديدة' }).click()
  await page.locator('.drawer .field', { hasText: 'عنوان الصفحة' }).locator('input').fill('صفحة بصورة')
  await page.locator('.drawer .field', { hasText: 'الرابط (slug)' }).locator('input').fill(slug)

  // Upload a hero image through the landing-upload path (storage.rules landingPages/).
  await page.locator('.landing-image-uploader input[type="file"]').first().setInputFiles([
    { name: 'hero.png', mimeType: 'image/png', buffer: PNG },
  ])
  await expect(page.locator('.landing-image-preview img').first()).toBeVisible({ timeout: 15000 })

  await page.locator('.drawer').getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect(page.locator('.drawer')).toHaveCount(0, { timeout: 15000 })

  // The image URL is persisted (would previously be dropped → undefined write error).
  const lp = (await pollValue(
    () => db.collection('landingPages').where('slug', '==', slug).limit(1).get().then((s) => (s.empty ? null : s.docs[0].data() as any)),
    (d) => d != null,
  ))!
  expect(lp.hero?.image).toMatch(/^https?:\/\//)

  // The public route only serves published+active pages — this editor draft was
  // saved as a draft, so publish it before visiting the storefront.
  const savedRef = await db.collection('landingPages').where('slug', '==', slug).limit(1).get()
  await savedRef.docs[0].ref.update({ status: 'published' })

  // The public landing page shows the uploaded hero image.
  await page.goto(`/landing/${slug}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.lp-hero-img').first()).toBeVisible({ timeout: 15000 })
  const src = await page.locator('.lp-hero-img').first().getAttribute('src')
  expect(src).toBe(lp.hero.image)
})

test('shipping: default provider honored (client+server) and refused-policy toggle gates checkout', async ({ page }) => {
  const { uniq, ref } = ctx()
  const store = (await storeBySlug(ref))!
  await db.collection('stores').doc(store.id).update({
    shipping: {
      enabled: true,
      model: 'flat',
      flatFee: 30,
      freeAbove: 0,
      refusedPolicy: 'الرفض يتحمل العميل رسوماً قدرها 50 جنيهاً.',
      refusedPolicyEnabled: true,
      defaultProviderId: 'reg-p2',
      providers: [
        { id: 'reg-p1', name: 'توصيل عادي', fee: 45, estimatedDays: '3-5 أيام', active: true },
        { id: 'reg-p2', name: 'توصيل سريع', fee: 25, estimatedDays: '1-2 أيام', active: true },
      ],
    },
  })

  await page.goto(`/store/${ref}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.store-card').first().click()
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${ref}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()

  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل الشحن التلقائي')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01099990011')
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'القاهرة' })
  await page.locator('.field', { hasText: 'المدينة' }).locator('input').fill('مدينة نصر')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع 11')

  // Default provider (توصيل سريع) is selected → its name + fee 25 show, and the
  // refused-policy message is visible because refusedPolicyEnabled=true.
  await expect(page.getByText('الشحن (توصيل سريع)')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('الرفض يتحمل العميل رسوماً قدرها 50 جنيهاً.')).toBeVisible()

  // Server recomputes the same default provider fee + policy.
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })
  const orderSnap = await db.collection('orders').where('storeId', '==', store.id).orderBy('createdAt', 'desc').limit(1).get()
  const order = orderSnap.docs[0].data() as any
  expect(order.shippingFee).toBe(25)
  expect(order.shippingMethod).toBe('توصيل سريع')
  expect(order.shippingSnapshot?.model).toBe('flat')
  expect(order.shippingSnapshot?.providerId).toBe('reg-p2')

  // Disabling the refused-policy hides the message at checkout (config change);
  // the server still resolves the same default provider for the next order.
  await db.collection('stores').doc(store.id).update({ 'shipping.refusedPolicyEnabled': false })
  await page.goto(`/store/${ref}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.store-card').first().click()
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${ref}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'القاهرة' })
  await expect(page.getByText('الرفض يتحمل العميل رسوماً قدرها 50 جنيهاً.')).toHaveCount(0, { timeout: 15000 })
  const again = await db.collection('orders').where('storeId', '==', store.id).orderBy('createdAt', 'desc').limit(1).get()
  expect((again.docs[0].data() as any).shippingFee).toBe(25)
})
