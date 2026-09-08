import { test, expect, type Page } from '@playwright/test'
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'
import { dismissMerchantTourIfVisible, safeClickWithTourGuard } from './helpers/tour-guard'

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'

const envRaw = readFileSync('.env.local', 'utf8')
const projectId = envRaw.match(/VITE_FIREBASE_PROJECT_ID=(\S+)/)?.[1] || 'mk-store-app'
if (!admin.apps.length) admin.initializeApp({ projectId })
const db = admin.firestore()
const ts = admin.firestore.FieldValue.serverTimestamp

// ── Helpers ─────────────────────────────────────────────
function uniq() {
  const p = test.info().project.name
  const base = p === 'desktop' ? 'desktop' : `m${p.replace('mobile-', '')}`
  return test.info().retry > 0 ? `${base}-retry${test.info().retry}` : base
}

async function login(page: Page, role: 'platform' | 'merchant', email: string, password: string) {
  await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  // The auth guard redirects an already-authenticated session away from /login
  // after hydration. If the login form never renders, sign out and retry.
  const loginEmail = page.locator('input[type="email"]')
  const accountTrigger = page.locator('.sidebar-logout:visible').first()
  await expect(loginEmail.or(accountTrigger)).toBeVisible({ timeout: 15000 })
  if (!(await loginEmail.isVisible())) {
    const logout = page.locator('.sidebar-logout:visible').first()
    if ((await logout.count()) === 0) {
      await page.locator('.sidebar-toggle:visible').first().click()
    }
    await accountTrigger.click()
    const logoutButton = page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).last()
    await expect(logoutButton).toBeVisible({ timeout: 5000 })
    await logoutButton.click()
    await page.waitForURL(/\/login/, { timeout: 15000 })
    await page.waitForLoadState('domcontentloaded')
    // Reset to a blank document to cancel any in-flight SPA navigation (e.g.
    // the default role redirect after logout) before a clean navigation. The
    // guard may still fire its redirect while we navigate, interrupting the
    // about:blank goto — treat that as expected and retry the real navigation.
    await page.goto('about:blank').catch(() => {})
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
        break
      } catch (err) {
        if (attempt === 2) throw err
        await page.waitForTimeout(200)
      }
    }
    await expect(loginEmail).toBeVisible({ timeout: 15000 })
  }
  await expect(loginEmail).toBeVisible({ timeout: 15000 })
  await loginEmail.fill(email)
  const passwordInput = page.locator('input[type="password"]').first()
  const submit = page.getByRole('button', { name: 'تسجيل الدخول', exact: true })
  await expect(passwordInput).toBeVisible({ timeout: 15000 })
  await passwordInput.fill(password)
  await expect(submit).toBeVisible({ timeout: 15000 })
  await submit.click()
  await page.waitForURL(/\/dashboard|\/platform/, { timeout: 15000 })
  if (role === 'merchant') await dismissMerchantTourIfVisible(page)
}

async function latestSub(storeId: string) {
  const snap = await db.collection('subscriptions').where('storeId', '==', storeId).get()
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
  docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  return docs[0] || null
}

async function pendingRequests(subId: string) {
  const snap = await db.collection('subscriptionPayments').where('subscriptionId', '==', subId).where('status', '==', 'pending').get()
  return snap.size
}

async function makeTrialStore(tag: string, planId = 'plan-starter', price = 399) {
  const u = uniq()
  const uid = `sub-owner-${tag}-${u}`
  const storeId = `sub-store-${tag}-${u}`
  const email = `sub-${tag}-${u}@mk.test`
  const password = 'Flow12345'
  await admin.auth().createUser({ uid, email, password, displayName: 'مالك التجربة' }).catch(() => {})
  await db.collection('users').doc(uid).set({
    uid, email, name: 'مالك التجربة', role: 'merchant', storeIds: [storeId], active: true,
    createdAt: ts(), updatedAt: ts(), createdBy: 'sub-spec',
  })
  await db.collection('stores').doc(storeId).set({
    ref: storeId, name: `متجر التجربة ${tag}`, slug: storeId, active: true, published: false, ownerId: uid,
    currency: 'EGP', description: 'متجر تجريبي', theme: { primary: '#6366f1', secondary: '#f59e0b', darkMode: false },
    createdAt: ts(), updatedAt: ts(), createdBy: 'sub-spec',
  })
  await db.collection('subscriptions').add({
    storeId, planId, planName: planId === 'plan-free' ? 'FREE' : 'البداية', status: 'trialing',
    trialStartedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
    trialEndsAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 86400000)),
    startedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
    expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 86400000)),
    normalPriceSnapshot: price, launchPriceSnapshot: price, yearlyPriceSnapshot: price * 10, ordersUsed: 0, periodNumber: 0,
    createdAt: ts(), updatedAt: ts(), createdBy: 'sub-spec',
  })
  return { uid, storeId, email, password }
}

test.describe.configure({ mode: 'serial' })

test('expired store is gated for visitors; products stay intact', async ({ page }) => {
  const { storeId } = await makeTrialStore('expired')
  const ref = await db.collection('products').add({
    storeId, name: 'منتج محفوظ', price: 100, stock: 5, active: true,
    images: [], variants: [], colors: [], sizes: [],
    createdAt: ts(), updatedAt: ts(), createdBy: 'sub-spec',
  })
  // Force the subscription to expired (trial ended) but keep the store published
  // so the gating comes from the subscription (not the unpublished rule).
  await db.collection('stores').doc(storeId).update({ published: true })
  await db.collection('subscriptions').where('storeId', '==', storeId).get().then((snap) =>
    snap.docs[0].ref.update({
      trialEndsAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
    }),
  )

  // Anonymous visitor sees the subscription-required page.
  await page.goto(`/store/${storeId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('المتجر غير متاح للشراء حالياً')).toBeVisible({ timeout: 15000 })

  // Server keeps merchant data intact — the product is not deleted.
  const productSnap = await ref.get()
  expect(productSnap.exists).toBe(true)
})

test('merchant activates during trial: submit payment → platform approves → active + orders reset', async ({ page, browser }) => {
  const { storeId, email, password } = await makeTrialStore('activate')
  const sub = (await latestSub(storeId))!
  await db.collection('subscriptions').doc(sub.id).update({ ordersUsed: 12 })

  // Merchant logs in (active immediately) and opens the subscription page.
  await login(page, 'merchant', email, password)
  await page.goto('/dashboard/subscription', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'تفعيل الاشتراك' })).toBeVisible({ timeout: 45000 })

  // This fixture is a legacy Starter trial. Its immutable 399 EGP price
  // snapshot must survive the launch-catalog change to 499 EGP.
  const renewalRow = page.locator('.subscription-summary-rows > div', { hasText: 'تكلفة التجديد' })
  await expect(renewalRow).toContainText(/(?:399|٣٩٩)/)

  // Submit a payment request.
  await page.locator('.field', { hasText: 'وسيلة الدفع' }).locator('input').fill('فودافون كاش')
  await page.locator('.field', { hasText: 'رقم العملية' }).locator('input').fill('123456789012')
  await safeClickWithTourGuard(page, page.getByRole('button', { name: 'إرسال طلب التفعيل' }))
  await expect(page.getByText('طلبك قيد المراجعة')).toBeVisible({ timeout: 15000 })

  expect(await pendingRequests(sub.id)).toBe(1)
  // Server computed the grandfathered snapshot, not the new catalog price.
  const paySnap = await db.collection('subscriptionPayments').where('subscriptionId', '==', sub.id).get()
  expect(paySnap.docs[0].data().amount).toBe(399)

  // Duplicate submission is blocked while a request is pending (still on the
  // same merchant session — no need to log in again).
  await page.goto('/dashboard/subscription', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('طلبك قيد المراجعة')).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'إرسال طلب التفعيل' })).toHaveCount(0)

  // Platform sees the request in the activation tab and approves it.
  const platformContext = await browser.newContext({ viewport: page.viewportSize() || { width: 1440, height: 900 } })
  const platformPage = await platformContext.newPage()
  try {
    await login(platformPage, 'platform', 'admin@mk.store', 'Admin12345')
    await platformPage.goto('/platform/payments', { waitUntil: 'domcontentloaded' })
    await platformPage.getByRole('tab', { name: /طلبات التفعيل/ }).click()
    const row = platformPage.locator('tr, .card-table-card', { hasText: '123456789012' }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    const approvalResponse = platformPage.waitForResponse((response) =>
      response.request().method() === 'POST' && response.url().includes('/approvePaymentRequest'),
    )
    await row.getByRole('button', { name: 'قبول' }).click()
    expect((await approvalResponse).ok()).toBe(true)
    await expect.poll(async () => (await latestSub(storeId))?.status, { timeout: 15000 }).toBe('active')
    await expect(platformPage.getByText('تم تفعيل الاشتراك')).toBeVisible({ timeout: 15000 })
  } finally {
    await platformContext.close()
  }

  // Subscription is now active with a fresh cycle; ordersUsed reset to 0.
  await expect.poll(async () => (await latestSub(storeId))?.status, { timeout: 15000 }).toBe('active')
  const after = await latestSub(storeId)
  expect(after.ordersUsed).toBe(0)
  expect(after.periodNumber).toBe(1)
  expect(after.launchUsed).toBe(false)
  expect(after.currentPeriodEnd).toBeTruthy()
  expect(after.trialEndsAt).toBeFalsy()
  expect(await pendingRequests(sub.id)).toBe(0)
})

test('expired merchant cannot publish (server-enforced)', async ({ page }) => {
  const { storeId, email, password } = await makeTrialStore('publish-blocked')
  // Force expiry.
  await db.collection('subscriptions').where('storeId', '==', storeId).get().then((snap) =>
    snap.docs[0].ref.update({
      trialEndsAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
    }),
  )

  await login(page, 'merchant', email, password)
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  if ((page.viewportSize()?.width ?? 0) < 768) {
    // The compact dashboard intentionally exposes publish status without the
    // desktop action control; server enforcement is covered on desktop.
    await expect(page.locator('.dashboard-mobile-published')).toContainText('مسودة', { timeout: 15000 })
    return
  }
  await expect(page.getByRole('button', { name: 'نشر المتجر' })).toBeVisible({ timeout: 15000 })
  await safeClickWithTourGuard(page, page.getByRole('button', { name: 'نشر المتجر' }))
  await expect(page.getByText('فشل تحديث حالة النشر')).toBeVisible({ timeout: 15000 })
  const storeSnap = await db.collection('stores').doc(storeId).get()
  expect(storeSnap.data()!.published).toBe(false)
})

test('expired Free merchant is gated but can request a 499 EGP Starter upgrade', async ({ page }) => {
  const { storeId, email, password } = await makeTrialStore('free-upgrade', 'plan-free', 0)
  await db.collection('subscriptions').where('storeId', '==', storeId).get().then((snap) =>
    snap.docs[0].ref.update({
      trialEndsAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
    }),
  )

  await login(page, 'merchant', email, password)
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await dismissMerchantTourIfVisible(page)
  await expect(page.getByText('هذه الميزة غير متاحة في باقتك الحالية')).toBeVisible({ timeout: 15000 })
  await page.goto('/dashboard/subscription', { waitUntil: 'domcontentloaded' })
  await dismissMerchantTourIfVisible(page)
  await expect(page.getByText('اختر Starter أو Growth أو Pro')).toBeVisible({ timeout: 15000 })
  await dismissMerchantTourIfVisible(page)
  await safeClickWithTourGuard(page, page.locator('.subscription-summary-actions').getByRole('button', { name: 'ترقية الخطة' }))
  const starter = page.locator('.mk-pricing-card').filter({ has: page.locator('.mk-pricing-name', { hasText: 'STARTER' }) }).last()
  await safeClickWithTourGuard(page, starter.getByRole('button', { name: 'اختيار' }))
  await page.getByRole('button', { name: 'تأكيد التغيير' }).click()

  const request = await expect.poll(async () => {
    const snap = await db.collection('subscriptionChangeRequests').where('storeId', '==', storeId).get()
    return snap.docs[0]?.data() || null
  }, { timeout: 15000 }).not.toBeNull()
  void request
  const change = (await db.collection('subscriptionChangeRequests').where('storeId', '==', storeId).get()).docs[0].data()
  expect(change).toMatchObject({ fromPlanId: 'plan-free', toPlanId: 'plan-starter', quotedAmount: 499, status: 'pending_payment' })
})

test('storefront is purchasable again after activation', async ({ page }) => {
  const { storeId } = await makeTrialStore('reactivate')
  const sub = (await latestSub(storeId))!

  // Simulate a completed activation (post-approval shape).
  await db.collection('subscriptions').doc(sub.id).update({
    status: 'active',
    activatedAt: ts(),
    currentPeriodStart: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
    currentPeriodEnd: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 29 * 86400000)),
    trialStartedAt: admin.firestore.FieldValue.delete(),
    trialEndsAt: admin.firestore.FieldValue.delete(),
    periodNumber: 1,
    launchUsed: true,
    ordersUsed: 0,
    approvedBy: 'admin@mk.store',
  })
  await db.collection('stores').doc(storeId).update({ published: true })

  // Public visitor can now browse the storefront.
  await page.goto(`/store/${storeId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-header')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('المتجر غير متاح للشراء حالياً')).toHaveCount(0)
})
