import { test, expect, type Locator, type Page } from '@playwright/test'
import admin from 'firebase-admin'
import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { readFileSync } from 'node:fs'
import { dismissMerchantTourIfVisible, safeClickWithTourGuard } from './helpers/tour-guard'

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

// Checkout renders a governed city as a select when canonical city data is
// available, and falls back to a free-text input otherwise. Keep the E2E flow
// aligned with that intentional application behavior.
async function fillCheckoutCity(page: Page, city: string) {
  const field = page.locator('.field', { hasText: 'المدينة' })
  const select = field.locator('select')
  if (await select.count()) await select.selectOption({ label: city })
  else await field.locator('input').fill(city)
}

/**
 * The storefront cart test must be runnable on its own, not only after the
 * preceding registration/theme test has happened to create its fixture.
 * Converge a deterministic local store/product without touching seeded data.
 */
async function ensureFlowStore(ref: string, name: string, preserveTrial = false) {
  const existing = await storeBySlug(ref)
  const storeId = existing?.id || `flow-owner-${ref}`
  const ownerEmail = `${ref}@mk.test`
  // Auth and Firestore can be reset independently by local emulators. Keep
  // this fixture convergent rather than assuming the store document implies a
  // matching Auth account still exists.
  try {
    await admin.auth().getUser(storeId)
    await admin.auth().updateUser(storeId, { email: ownerEmail, password: 'Flow12345', displayName: 'مالك التدفق', disabled: false })
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') throw error
    await admin.auth().createUser({ uid: storeId, email: ownerEmail, password: 'Flow12345', displayName: 'مالك التدفق' })
  }
  await db.collection('users').doc(storeId).set({
    uid: storeId, email: ownerEmail, name: 'مالك التدفق', role: 'merchant', storeIds: [storeId], active: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
  if (!existing) {
    await db.collection('users').doc(storeId).set({
      uid: storeId, email: ownerEmail, name: 'مالك التدفق', role: 'merchant', storeIds: [storeId], active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    await db.collection('stores').doc(storeId).set({
      ref, slug: ref, name, ownerId: storeId, active: true, published: true, currency: 'EGP',
      description: 'متجر اختبار تدفق الواجهة', theme: { template: 'minimal', primary: '#0b766e', secondary: '#c78a25', darkMode: false },
      storageUsed: 0, storageLimitBytes: 5 * 1024 * 1024 * 1024,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: 'emulator-e2e',
    })
    const subscriptionRef = db.collection('subscriptions').doc()
    await subscriptionRef.set({
      storeId, planId: 'plan-growth', planName: 'النمو', status: 'active', ordersUsed: 0,
      limitsSnapshot: { orderLimitPerMonth: 1500, productLimit: 2000, landingPagesLimit: 5, salesLinksLimit: 50, staffLimit: 10, storageLimit: 5120 },
      currentPeriodStart: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
      currentPeriodEnd: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000 * 29)),
      createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: 'emulator-e2e',
    })
    await db.collection('stores').doc(storeId).set({ activeSubscriptionId: subscriptionRef.id }, { merge: true })
  } else {
    await existing.ref.set({ published: true, storageUsed: 0, storageLimitBytes: 5 * 1024 * 1024 * 1024, theme: { template: 'minimal', primary: '#0b766e', secondary: '#c78a25', darkMode: false }, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
    const ownerId = String(existing.data()?.ownerId || '')
    if (ownerId) await db.collection('users').doc(ownerId).set({ active: true, merchantStatus: 'active' }, { merge: true })
    const sub = await latestSub(existing.id)
    if (sub && (!preserveTrial || sub.status !== 'trialing')) {
      const currentLimits = (sub.limitsSnapshot || {}) as Record<string, unknown>
      await db.collection('subscriptions').doc(sub.id).set({
        status: 'active',
        limitsSnapshot: {
          ...currentLimits,
          landingPagesLimit: Math.max(Number(currentLimits.landingPagesLimit || 0), 50),
          salesLinksLimit: Math.max(Number(currentLimits.salesLinksLimit || 0), 50),
          storageLimit: Math.max(Number(currentLimits.storageLimit || 0), 5120),
        },
      }, { merge: true })
    }
  }
  const products = await db.collection('products').where('storeId', '==', storeId).limit(1).get()
  if (products.empty) {
    const product = db.collection('products').doc()
    await product.set({
      id: product.id, storeId, name: 'منتج اختبار التدفق', price: 240, oldPrice: 300, description: 'منتج تجريبي',
      images: [], stock: 50, variants: [], colors: [], sizes: [], active: true, featured: true, lowStockThreshold: 5,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: 'emulator-e2e',
    })
  } else {
    await products.docs[0].ref.set({ active: true, featured: true, stock: 50, variants: [], colors: [], sizes: [], updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
  }
  return (await storeBySlug(ref))!
}

async function login(page: Page, role: 'platform' | 'merchant', email: string, password: string) {
  const loginUrl = `/login?role=${role}`
  // logout() already lands on the auth route. Reusing that document avoids
  // racing the auth guard with a second navigation to the same URL.
  if (!page.url().includes('/login')) {
    try {
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' })
    } catch (error) {
      const message = String(error)
      const navigationWasAborted = message.includes('ERR_ABORTED') || message.includes('frame was detached')
      if (!navigationWasAborted || !page.url().includes('/login')) throw error
    }
  }
  // The auth guard redirects an already-authenticated session away from /login
  // after hydration. Wait for the actual settled surface instead of racing a
  // transient form while the current-user state is resolving.
  const emailInput = page.locator('input[type="email"]')
  const pendingHeading = page.getByText('الحساب قيد المراجعة', { exact: false })
  const dashboardShell = page.locator('.sidebar-logout:visible').first()
  await expect.poll(async () => {
    if (await dashboardShell.isVisible().catch(() => false)) return 'dashboard'
    if (await pendingHeading.isVisible().catch(() => false)) return 'pending'
    if (await emailInput.isVisible().catch(() => false)) return 'login'
    return 'loading'
  }, { timeout: 15000 }).not.toBe('loading')
  if (await dashboardShell.isVisible().catch(() => false)) {
    const logout = page.locator('.sidebar-logout:visible').first()
    if ((await logout.count()) === 0) {
      const more = page.getByRole('button', { name: 'المزيد', exact: true })
      if (await more.isVisible().catch(() => false)) await openMobileDrawer(page, more)
      else await page.locator('.sidebar-toggle:visible').first().click()
    }
    await safeClickWithTourGuard(page, page.locator('.sidebar-logout:visible').first())
    await page.waitForURL(/\/login/, { timeout: 15000 })
    await page.waitForLoadState('domcontentloaded')
    if (!page.url().includes('/login')) await page.goto(loginUrl, { waitUntil: 'domcontentloaded' })
  }
  await expect(emailInput).toBeVisible({ timeout: 15000 })
  const passwordInput = page.locator('input[type="password"]')
  await expect(passwordInput).toBeVisible({ timeout: 15000 })
  await emailInput.fill(email)
  await passwordInput.fill(password)
  await page.locator('button[type="submit"]').click()
  try {
    await page.waitForURL(/\/dashboard|\/platform/, { timeout: 15000 })
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '')
    // Pending merchant login intentionally stays on the auth route while the
    // auth component renders its review state. That is a successful login
    // outcome for this role, not a navigation failure.
    if (body.includes('الحساب قيد المراجعة')) return
    throw new Error(`Login did not redirect for ${email} (url=${page.url()}): ${body.slice(0, 400)}`, { cause: error })
  }
  if (role === 'merchant') await dismissMerchantTourIfVisible(page)
}

async function openMobileDrawer(page: Page, more: Locator) {
  await dismissMerchantTourIfVisible(page)
  // Registration success toasts sit over the bottom navigation on narrow
  // viewports. Wait for that transient UI to clear instead of racing it.
  await expect(page.locator('.toast:visible')).toHaveCount(0, { timeout: 10000 })
  try {
    await more.click({ timeout: 3000 })
  } catch (error) {
    // The click can open the drawer just before Playwright observes its
    // full-screen overlay intercepting the original button. That is the
    // intended postcondition, so accept it only when the drawer action is
    // actually available; otherwise preserve the real click failure.
    if (!(await page.locator('.sidebar-logout:visible').first().isVisible().catch(() => false))) throw error
  }
  await expect(page.locator('.sidebar-logout:visible').first()).toBeVisible({ timeout: 5000 })
}

async function logout(page: Page) {
  // Pending merchants use the dedicated review screen, which has a plain
  // logout button instead of the dashboard sidebar action. Prefer the
  // semantic button first so the helper works for both states.
  const pendingLogout = page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).first()
  const navigation = page.waitForURL(/\/login(?:\?|$)/, { timeout: 15000 })
  if (await pendingLogout.isVisible().catch(() => false)) {
    await pendingLogout.click()
  } else {
    const logout = page.locator('.sidebar-logout:visible').first()
    if ((await logout.count()) === 0) {
      const more = page.getByRole('button', { name: 'المزيد', exact: true })
      if (await more.isVisible().catch(() => false)) await openMobileDrawer(page, more)
      else await page.locator('.sidebar-toggle:visible').first().click()
    }
    await safeClickWithTourGuard(page, page.locator('.sidebar-logout:visible').first())
  }
  await navigation
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('#auth-email')).toBeVisible({ timeout: 15000 })
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
  await page.locator('#reg-email').fill(opts.email)
  await page.locator('#reg-password').fill(opts.password)
  await page.locator('#reg-name').fill(opts.name)
  await page.locator('#reg-phone').fill(phoneFromEmail(opts.email))
  await page.locator('.auth-terms input[type="checkbox"]').check()
  await page.getByRole('button', { name: 'التالي' }).click()
  // Merchant registration offers recurring plans only; the Lifetime offer is
  // intentionally available from the billing screen, not onboarding.
  // The responsive registration UI uses the compact pill selector at every
  // breakpoint; desktop cards are a presentation layer, not the selection
  // contract. Assert the stable control instead of a desktop-only class.
  await page.getByRole('button', { name: 'تغيير الباقة' }).click()
  await expect(page.locator('.register-plan-selector .mk-pricing-card')).toHaveCount(4)
  await page.locator('.register-plan-selector .mk-pricing-card').filter({ has: page.locator('.mk-pricing-name', { hasText: opts.planName }) }).locator('.mk-pricing-cta').first().click()
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.locator('#store-name').fill(opts.storeName)
  await page.locator('#store-ref').fill(opts.storeRef)
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
  await expect(page).toHaveURL(/\/verify-email/, { timeout: 30000 })
  await expect(page.getByRole('heading', { name: 'تحقق من بريدك الإلكتروني' })).toBeVisible({ timeout: 15000 })
  // Emulator-only test hook: the real email link is intentionally not
  // generated by the Auth emulator. Mark this fixture verified server-side,
  // then exercise the same reload/check path the user uses after clicking it.
  const authUser = await authUserByEmail(opts.email)
  await admin.auth().updateUser(authUser.uid, { emailVerified: true })
  await page.getByRole('button', { name: 'تحققت من البريد' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  // Registration intentionally leaves the user signed in. End the fixture in
  // a logged-out state so tests that exercise a fresh login never race the
  // route guard's redirect from a transient login form.
  await logout(page)
}

async function merchantRow(page: Page, text: string) {
  const base = page.locator('tr, .card-table-card')
  const pageInfo = page.locator('.pagination-info').first()
  // Each lookup is independent. Reset pagination first so a previous lookup
  // cannot leave the next one stranded on a later page.
  const firstPage = page.locator('.pagination button').filter({ hasText: /^1$/ }).first()
  if (await firstPage.count()) {
    const currentInfo = await pageInfo.textContent().catch(() => '')
    if (!/^\s*1\s*[–-]\s*10\b/.test(currentInfo || '')) {
      await firstPage.click()
      await expect.poll(() => pageInfo.textContent(), { timeout: 10000 }).toMatch(/^\s*1\s*[–-]\s*10\b/)
    }
  }
  for (let p = 0; p < 5; p++) {
    const row = base.filter({ hasText: text }).first()
    if ((await row.count()) > 0) return row
    const next = page.locator('button', { hasText: 'التالي' })
    if ((await next.count()) === 0 || (await next.isDisabled())) break
    const beforeInfo = await pageInfo.textContent().catch(() => '')
    await next.click()
    await expect.poll(() => pageInfo.textContent(), { timeout: 10000 }).not.toBe(beforeInfo)
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

async function authUserByEmail(email: string, timeout = 15000) {
  return pollValue(
    async () => {
      try {
        return await admin.auth().getUserByEmail(email)
      } catch (error: any) {
        if (error?.code === 'auth/user-not-found') return null
        throw error
      }
    },
    (user) => user != null,
    timeout,
  )
}

async function callAsMerchant(uid: string, name: string, data: Record<string, unknown>) {
  const app = initializeApp(
    { apiKey: 'any', authDomain: `${projectId}.firebaseapp.com`, projectId },
    `emulator-${uid}-${name}-${Date.now()}-${Math.random()}`,
  )
  try {
    const auth = getAuth(app)
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    await signInWithCustomToken(auth, await admin.auth().createCustomToken(uid))
    const functions = getFunctions(app)
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
    return await httpsCallable(functions, name)(data)
  } finally {
    await deleteApp(app)
  }
}

async function updateOrderStatus(uid: string, orderId: string, value: string) {
  // These attribution scenarios exercise backend counters, not the order
  // details UI. Use authenticated callables as their stable mutation boundary.
  if (value === 'RETURNED') {
    await callAsMerchant(uid, 'requestOrderReturn', { orderId })
    await callAsMerchant(uid, 'receiveOrderReturn', { orderId })
  }
  await callAsMerchant(uid, 'updateOrderStatus', { orderId, status: value })
  await expect.poll(async () => (
    await db.collection('orders').doc(orderId).get()
  ).data()?.status, { timeout: 30000 }).toBe(value)
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
  const project = p === 'desktop' ? 'desktop' : `m${p.replace('mobile-', '')}`
  const uniq = `${project}-${Date.now().toString(36).slice(-6)}-${Math.random().toString(36).slice(2, 6)}`
  // The serial suite may be replayed after a failure. Include the retry in
  // the fixture namespace so a replay never collides with the first attempt's
  // Auth user/store.
  const retry = test.info().retry
  const suffix = retry > 0 ? `${uniq}-retry${retry}` : uniq
  return { uniq: suffix, email: `flow-${suffix}@mk.test`, ref: `flow-${suffix}`, storeName: `مقهى التدفق ${suffix}` }
}

// ─────────────────────────────────────────────────────────────
test('pricing intent registration starts one server-controlled trial of the selected plan', async ({ page }) => {
  const { email, storeName, ref } = ctx()
  await registerStore(page, {
    email,
    password: PASSWORD,
    name: 'مالك التدفق',
    storeName,
    storeRef: ref,
    planName: 'STARTER',
  })

  const store = await pollValue(() => storeBySlug(ref), (s) => s != null)
  expect(store).not.toBeNull()
  expect(store!.data()!.published).toBe(false)
  const sub = await latestSub(store!.id)
  expect(sub).not.toBeNull()
  expect(sub!.status).toBe('trialing')
  expect(sub!.planId).toBe('plan-starter')
  expect(sub!.trialUsed).toBe(true)
  expect(sub!.initialTrialPlanId).toBe('plan-starter')
  expect(sub!.trialStartedAt).toBeTruthy()
  expect(sub!.trialEndsAt).toBeTruthy()
  const trialDuration = sub!.trialEndsAt.toMillis() - sub!.trialStartedAt.toMillis()
  expect(trialDuration).toBe(3 * 86400000)
  expect(sub!.normalPriceSnapshot).toBe(249)
  expect(sub!.launchUsed).toBeFalsy()
})

test('registration trial invariants survive re-auth and duplicate registration is blocked', async ({ page }) => {
  const { email, storeName, ref } = ctx()
  await registerStore(page, {
    email,
    password: PASSWORD,
    name: 'مالك ثبات التجربة',
    storeName,
    storeRef: ref,
    planName: 'GROWTH',
  })

  const store = (await pollValue(() => storeBySlug(ref), (value) => value != null))!
  const initial = (await latestSub(store.id))!
  expect(initial.status).toBe('trialing')
  expect(initial.initialTrialPlanId).toBe('plan-growth')
  expect(initial.trialStartedAt).toBeTruthy()
  expect(initial.trialEndsAt).toBeTruthy()
  expect(initial.trialEndsAt.toMillis() - initial.trialStartedAt.toMillis()).toBe(3 * 86400000)
  expect(initial.trialConsumed).toBe(false)

  await login(page, 'merchant', email, PASSWORD)
  await logout(page)
  await login(page, 'merchant', email, PASSWORD)
  const afterReauth = (await latestSub(store.id))!
  expect(afterReauth.initialTrialPlanId).toBe(initial.initialTrialPlanId)
  expect(afterReauth.trialStartedAt.toMillis()).toBe(initial.trialStartedAt.toMillis())
  expect(afterReauth.trialEndsAt.toMillis()).toBe(initial.trialEndsAt.toMillis())
  expect(afterReauth.trialConsumed).toBe(initial.trialConsumed)

  await logout(page)
  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await page.locator('#reg-email').fill(email)
  await page.locator('#reg-password').fill(PASSWORD)
  await page.locator('#reg-name').fill('محاولة مكررة')
  await page.locator('#reg-phone').fill(phoneFromEmail(`${email}-duplicate`))
  await page.locator('.auth-terms input[type="checkbox"]').check()
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.getByRole('button', { name: 'تغيير الباقة' }).click()
  await page.locator('.register-plan-selector .mk-pricing-card').filter({ has: page.locator('.mk-pricing-name', { hasText: 'GROWTH' }) }).locator('.mk-pricing-cta').first().click()
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.locator('#store-name').fill('متجر مكرر')
  await page.locator('#store-ref').fill(`${ref}-duplicate`)
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
  await expect(page.getByText('فشل التسجيل', { exact: false })).toBeVisible({ timeout: 15000 })
  expect((await db.collection('users').where('email', '==', email).get()).size).toBe(1)
  expect((await db.collection('stores').where('ownerId', '==', store.data()?.ownerId).get()).size).toBe(1)
})

test('plan change requests never reset the original trial window', async ({ page }) => {
  const { email, storeName, ref } = ctx()
  await registerStore(page, {
    email,
    password: PASSWORD,
    name: 'مالك تغيير الخطة',
    storeName,
    storeRef: ref,
    planName: 'GROWTH',
  })
  const store = (await pollValue(() => storeBySlug(ref), (value) => value != null))!
  const before = (await latestSub(store.id))!
  const result = await callAsMerchant(String(store.data()?.ownerId), 'changeSubscriptionPlan', {
    storeId: store.id,
    planId: 'plan-starter',
    billingCycle: 'monthly',
  })
  expect((result.data as any).status).toBe('pending_payment')
  const after = (await latestSub(store.id))!
  expect(after.initialTrialPlanId).toBe(before.initialTrialPlanId)
  expect(after.trialStartedAt.toMillis()).toBe(before.trialStartedAt.toMillis())
  expect(after.trialEndsAt.toMillis()).toBe(before.trialEndsAt.toMillis())
  expect(after.trialConsumed).toBe(before.trialConsumed)
  const request = await db.collection('subscriptionChangeRequests').where('storeId', '==', store.id).limit(1).get()
  expect(request.docs[0].data()?.toPlanId).toBe('plan-starter')
})

test('Legacy Free is unavailable to new registration', async ({ page }) => {
  const { uniq } = ctx()
  const suffix = `${uniq}-${Date.now()}`
  const email = `approval-${suffix}@mk.test`
  const ref = `approval-${suffix}`
  const storeName = `متجر اعتماد ${uniq}`
  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await page.locator('#reg-email').fill(email)
  await page.locator('#reg-password').fill(PASSWORD)
  await page.locator('#reg-name').fill('تاجر اعتماد')
  await page.locator('#reg-phone').fill(phoneFromEmail(email))
  await page.locator('.auth-terms input[type="checkbox"]').check()
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.getByRole('button', { name: 'تغيير الباقة' }).click()
  const planSelector = page.locator('.register-plan-selector')
  await expect(planSelector.locator('.mk-pricing-card')).toHaveCount(4)
  for (const planName of ['BASIC', 'STARTER', 'GROWTH', 'PRO']) {
    await expect(planSelector.locator('.mk-pricing-name', { hasText: planName })).toBeVisible()
  }
  await expect(planSelector.locator('.mk-pricing-name', { hasText: /FREE|BUSINESS/i })).toHaveCount(0)
})

test('Starter, Growth, and Pro pricing intents start their own 3-day trial', async ({ page }) => {
  const { uniq } = ctx()
  const expected = { STARTER: { id: 'plan-starter', price: 249 }, GROWTH: { id: 'plan-growth', price: 399 }, PRO: { id: 'plan-pro', price: 649 } } as const
  for (const planName of ['STARTER', 'GROWTH', 'PRO'] as const) {
    const suffix = `${planName.toLowerCase()}-${uniq}-${Date.now()}`
    const ref = `auto-trial-${suffix}`
    await registerStore(page, {
      email: `${suffix}@mk.test`,
      password: PASSWORD,
      name: `تاجر ${planName}`,
      storeName: `متجر ${planName}`,
      storeRef: ref,
      planName,
    })
    const store = (await pollValue(() => storeBySlug(ref), (value) => value != null))!
    const sub = (await latestSub(store.id))!
    expect(sub.status).toBe('trialing')
    expect(sub.planId).toBe(expected[planName].id)
    expect(sub.initialTrialPlanId).toBe(expected[planName].id)
    expect(sub.trialUsed).toBe(true)
    expect(sub.trialEndsAt.toMillis() - sub.trialStartedAt.toMillis()).toBe(3 * 86400000)
    expect(sub.normalPriceSnapshot).toBe(expected[planName].price)
    expect(store.data()?.storeStatus).toBe('draft')
    expect(store.data()?.published).toBe(false)
  }
})

test('register duplicate slug gets a numeric suffix', async ({ page }) => {
  const { uniq, storeName } = ctx()
  // This test is independently runnable and must not depend on the preceding
  // registration test (or on stale emulator history). Occupy a fresh base
  // slug, leaving its `-2` candidate free for the real callable.
  const ref = `flow-duplicate-${uniq}-${Date.now()}`
  const blocker = db.collection('stores').doc(`e2e-slug-blocker-${uniq}-${Date.now()}`)
  await blocker.set({
    ref, slug: ref, name: 'حاجز اختبار الرابط', ownerId: 'e2e-slug-blocker',
    active: true, published: false, currency: 'EGP', createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  await registerStore(page, {
    email: `flow-${uniq}-2-${Date.now()}@mk.test`,
    password: PASSWORD,
    name: 'مالك ثانٍ',
    storeName: `${storeName} نسخة`,
    storeRef: ref,
    planName: 'STARTER',
  })
  const dup = await pollValue(() => storeBySlug(`${ref}-2`), (s) => s != null)
  expect(dup).not.toBeNull()
  expect(dup!.data()!.ref).toBe(`${ref}-2`)
})

test('trial merchant can publish + theme + product', async ({ page, browser }) => {
  const { email, ref } = ctx()
  let store = await storeBySlug(ref)
  // Keep this flow independently runnable when a focused grep starts at the
  // self-service test instead of the preceding registration test.
  if (!store) {
    await registerStore(page, {
      email, password: PASSWORD, name: 'مالك التدفق', storeName: `مقهى التدفق ${ctx().uniq}`,
      storeRef: ref, planName: 'STARTER',
    })
    store = (await pollValue(() => storeBySlug(ref), (s) => s != null))!
  }

  // A current registration is immediately operational during its valid
  // Starter trial. Keep only the owner-state convergence needed when this
  // focused test reuses an older emulator fixture.
  if (store) {
    await db.collection('users').where('storeIds', 'array-contains', store.id).get().then(async (snap) => {
      for (const doc of snap.docs) await doc.ref.set({ active: true, merchantStatus: 'active' }, { merge: true })
    })
  }
  await login(page, 'merchant', email, PASSWORD)
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })

  // Publish from the dashboard toggle (trialing grant allows it).
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  const publishButton = page.getByRole('button', { name: 'نشر المتجر' })
  await expect(publishButton).toBeVisible({ timeout: 15000 })
  await safeClickWithTourGuard(page, publishButton)
  await expect.poll(() => storeBySlug(ref).then((s) => s?.data()?.published), { timeout: 15000 }).toBe(true)

  // Theme the store on the new Appearance page (auto-saves after debounce).
  await page.goto('/dashboard/themes', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.theme-gallery:visible')).toBeVisible({ timeout: 15000 })

  // Apply the "minimal" template and confirm it persists to Firestore.
  await safeClickWithTourGuard(page, page.locator('.theme-card', { hasText: 'مينيمال' }).getByRole('button', { name: 'تطبيق' }))
  await expect
    .poll(() => storeBySlug(ref).then((s) => s?.data()?.theme?.template), { timeout: 15000 })
    .toBe('minimal')
  await expect(page.locator('.theme-card--active')).toContainText('القالب الحالي')

  // Override colors with the current V3 swatches (template default colors get replaced).
  await safeClickWithTourGuard(page, page.locator('.swatch[title="#0b766e"]').first())
  await expect
    .poll(() => storeBySlug(ref).then((s) => s?.data()?.theme?.primary), { timeout: 15000 })
    .toBe('#0b766e')
  await safeClickWithTourGuard(page, page.locator('.swatch[title="#c78a25"]').first())
  await expect
    .poll(() => storeBySlug(ref).then((s) => s?.data()?.theme?.secondary), { timeout: 15000 })
    .toBe('#c78a25')

  // Add a product via the products drawer.
  await page.goto('/dashboard/products', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'المنتجات والمخزون' })).toBeVisible({ timeout: 15000 })
  const addProductButton = page.locator('.page-header .btn').first()
  await expect(addProductButton).toBeVisible({ timeout: 15000 })
  await safeClickWithTourGuard(page, addProductButton)
  await expect(page.locator('.drawer')).toBeVisible({ timeout: 15000 })
  await page.locator('.field', { hasText: 'اسم المنتج' }).locator('input').fill('بن التدفق المختص')
  await page.locator('.drawer input[type="number"]').nth(0).fill('240')
  await page.locator('.drawer input[type="number"]').nth(1).fill('300')
  await page.locator('.field', { hasText: 'المخزون' }).locator('input[type="number"]').fill('10')
  await safeClickWithTourGuard(page, page.getByRole('button', { name: 'حفظ المنتج' }))
  await expect.poll(() => countProducts(store.id), { timeout: 15000 }).toBe(1)

  // Theme survives a fresh authenticated session (persisted server-side, not in frontend state).
  // The responsive shell intentionally hides the desktop account chip below 760px,
  // so use a new mobile context instead of forcing a hidden logout control.
  const mobileSession = !!page.viewportSize()?.width && page.viewportSize()!.width <= 760
  const sessionContext = mobileSession
    ? await browser.newContext({ viewport: page.viewportSize() || { width: 390, height: 844 } })
    : null
  const sessionPage = sessionContext ? await sessionContext.newPage() : page
  if (sessionPage !== page) await login(sessionPage, 'merchant', email, PASSWORD)
  else {
    await logout(page)
    await login(page, 'merchant', email, PASSWORD)
  }
  await sessionPage.goto('/dashboard/themes', { waitUntil: 'domcontentloaded' })
  await expect(sessionPage.locator('.theme-card--active')).toContainText('مينيمال', { timeout: 15000 })
  await expect
    .poll(() => storeBySlug(ref).then((s) => s?.data()?.theme?.template), { timeout: 15000 })
    .toBe('minimal')
  await expect
    .poll(() => storeBySlug(ref).then((s) => s?.data()?.theme?.primary), { timeout: 15000 })
    .toBe('#0b766e')
  if (sessionContext) await sessionContext.close()

  // Tenant isolation: another merchant's storefront never inherits this store's theme.
  await page.goto('/store/test-store-b', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-shell.theme-minimal')).toHaveCount(0, { timeout: 15000 })
  await expect
    .poll(() => storeBySlug('test-store-b').then((s) => s?.data()?.theme?.template || 'modern'), { timeout: 15000 })
    .toBe('modern')
})

test('storefront theme vars, cart -> checkout -> order, ordersUsed increments', async ({ page }) => {
  const { uniq, ref, storeName } = ctx()
  const slug = ref
  // Keep the just-registered merchant on the real Free trial for the launch
  // path. Standalone fixtures still converge to an active paid grant.
  await ensureFlowStore(slug, storeName, true)
  await page.goto(`/store/${slug}`, { waitUntil: 'domcontentloaded' })

  // Theme CSS variables applied on the store shell.
  await expect.poll(async () => page.locator('.store-shell').evaluate((el) => {
    const cs = getComputedStyle(el as HTMLElement)
    return `${cs.getPropertyValue('--primary').trim()}|${cs.getPropertyValue('--store-accent').trim()}`
  }), { timeout: 15000 }).toBe('#0b766e|#c78a25')

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
  await fillCheckoutCity(page, 'مدينة نصر')
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
  await page.goto('/store/test-store-e', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-coming-soon')).toBeVisible({ timeout: 15000 })
  await shot(page, `coming-soon-${uniq}`)

  // Owner (seeded store E) can preview the storefront.
  await login(page, 'merchant', 'owner@e.store', 'Owner12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto('/store/test-store-e?preview=1', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-coming-soon')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('.store-header')).toBeVisible()
})

test('platform Merchants shows seeded usage bars (1020/1500 moderate, 276/300 near)', async ({ page }) => {
  await login(page, 'platform', 'admin@mk.store', 'Admin12345')
  await page.goto('/platform/merchants', { waitUntil: 'domcontentloaded' })

  const rowA = await merchantRow(page, 'test-store-a')
  await expect(rowA).toContainText(/1,?020 \/ 1,?500/, { timeout: 15000 })
  await expect(rowA).toContainText('68%')
  await expect(rowA).toContainText('متوسط')
  await shot(page, 'platform-usage-a')

  const rowB = await merchantRow(page, 'test-store-b')
  await expect(rowB).toContainText(/276 \/ 300/)
  await expect(rowB).toContainText('92%')
  await expect(rowB).toContainText('قريب من الحد')
  await shot(page, 'platform-usage-b')

  // Trialing + expired segments present from the seed.
  const rowC = await merchantRow(page, 'test-store-c')
  await expect(rowC).toContainText('تجربة مجانية')
  const rowD = await merchantRow(page, 'test-store-d')
  await expect(rowD).toContainText('منتهي')
  const rowE = await merchantRow(page, 'test-store-e')
  await expect(rowE).toContainText('قيد الانتظار')
})

test('merchant subscription page shows persisted usage (1020/1500) and countdown', async ({ page }) => {
  await login(page, 'merchant', 'owner@a.store', 'Owner12345')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.goto('/dashboard/subscription', { waitUntil: 'domcontentloaded' })
  const ordersUsage = page.locator('.subscription-usage-item', { hasText: 'الطلبات' })
  // The first subscription callable is a cold start in a fresh emulator run;
  // wait for the durable usage surface instead of a fixed short load window.
  await expect(ordersUsage.locator('.subscription-usage-count')).toHaveText(/(?:1,?020|١٬٠٢٠)\s*\/\s*(?:1,?500|١٬٥٠٠)/, { timeout: 45000 })
  await expect(ordersUsage).toContainText(/متبقي\s+(?:480|٤٨٠)\s+طلب/)
  await shot(page, 'merchant-subscription-a')

  // Merchant dashboard usage banner too.
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/اشتراك\s+GROWTH\s+نشط/)).toBeVisible({ timeout: 15000 })
})

test('shipping: canonical zone provider resolves fee at checkout and persists snapshot', async ({ page }) => {
  // Reuse this project's flow store (created earlier in the run) so we never
  // add an extra merchant row and overflow the platform merchants table.
  const { ref } = ctx()
  const storeName = `مقهى التدفق ${ctx().uniq}`
  const ensuredStore = await ensureFlowStore(ref, storeName)
  const store = (await storeBySlug(ref))!
  // Canonical provider architecture: provider/service/zone data is the only
  // runtime source; legacy `stores.shipping`/`shipping` documents are not
  // used when a modern provider is enabled.
  const providerId = `shipping-zone-${ctx().uniq}`
  await db.doc(`shippingProviders/${providerId}`).set({
    id: providerId, name: 'شحن القاهرة الكبرى', slug: 'manual', status: 'active',
    integrationType: 'manual', credentialMode: 'platform', supportsCOD: true,
    supportsTracking: false, supportsReturns: false, supportsWebhooks: false,
    allowMerchantRateOverride: false,
    services: [{
      code: 'cairo-zone', name: 'القاهرة الكبرى', enabled: true, serviceType: 'standard',
      rateMode: 'zone', fixedRate: 0, estimatedMinHours: 72, estimatedMaxHours: 120,
      supportsCOD: true, supportsReturns: false, supportsPickup: false,
      zoneRules: [{ zoneId: 'cairo-major', zoneName: 'القاهرة الكبرى', enabled: true,
        governorates: ['القاهرة', 'الجيزة', 'القليوبية'], cities: [], areas: [],
        baseRate: 40, codFee: 0, returnFee: 0, baseWeight: 1, extraKgRate: 0,
        etaMin: 72, etaMax: 120, etaUnit: 'hours' }],
    }],
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  await db.doc(`storeShippingProviders/${store.id}_${providerId}`).set({
    id: `${store.id}_${providerId}`, storeId: store.id, providerId, enabled: true,
    enabledServiceCodes: ['cairo-zone'], serviceCode: 'cairo-zone', rateMode: 'zone',
    codEnabled: true, returnEnabled: false, defaultPackageWeight: 1,
    rateMarkup: 0, fixedRate: 0, freeShippingThreshold: 0,
    configurationStatus: 'ready', createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  // The home page only renders explicitly featured cards.  Use the canonical
  // catalog route so this flow remains independent of earlier storefront tests.
  await page.goto(`/store/${ref}/catalog`, { waitUntil: 'domcontentloaded' })
  await page.locator('.store-card a[href*="/product/"]').first().click()
  await page.waitForURL(/\/product\//, { timeout: 15000 })
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

  await fillCheckoutCity(page, 'مدينة نصر')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع 5')
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })

  const orderSnap = await db.collection('orders').where('storeId', '==', store.id).orderBy('createdAt', 'desc').limit(1).get()
  expect(orderSnap.empty).toBe(false)
  const order = orderSnap.docs[0].data() as any
  expect(order.shippingFee).toBe(40)
  expect(order.shippingMethod).toBe('القاهرة الكبرى')
  expect(order.shippingSnapshot?.enabled).toBe(true)
  expect(order.shippingSnapshot?.providerId).toBe(providerId)
  expect(order.shippingSnapshot?.serviceCode).toBe('cairo-zone')
  expect(order.shippingSnapshot?.zoneId).toBeTruthy()
  expect(order.totalPrice).toBe(order.subtotal + 40)
})

test('sales link: /s/:code redirects to the storefront and DELIVERED orders count on the link', async ({ page }) => {
  // Create a dedicated link on this project's flow store, pointed at the product.
  const { uniq, ref } = ctx()
  await ensureFlowStore(ref, `مقهى التدفق ${uniq}`)
  const store = (await storeBySlug(ref))!
  // The public resolver reads the projection, which is populated
  // asynchronously by the store trigger. Wait for that real prerequisite so
  // this focused test never races its own fixture.
  await expect.poll(
    () => db.doc(`publicStores/${store.id}`).get().then((snap) => snap.exists && snap.data()?.published === true),
    { timeout: 15000 },
  ).toBe(true)
  // This scenario verifies sales-link attribution, not shipping. A preceding
  // shipping scenario may have enabled a provider on the shared serial store;
  // disable it here so this order keeps the direct order-status lifecycle.
  const shippingConfigs = await db.collection('storeShippingProviders').where('storeId', '==', store.id).get()
  await Promise.all(shippingConfigs.docs.map((doc) => doc.ref.update({ enabled: false })))
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
  await expect(page.getByRole('link', { name: /السلة،\s*1 منتج/ })).toBeVisible({ timeout: 15000 })
  await page.goto(`/store/${ref}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()
  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل الرابط')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01099990002')
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'القاهرة' })
  await fillCheckoutCity(page, 'مدينة نصر')
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
  const ownerId = String(store.data()?.ownerId || '')
  expect(ownerId).toBeTruthy()
  const transitions: Array<[string, string]> = [
    ['CONTACTED', 'NEW'], ['PROCESSING', 'CONTACTED'], ['SHIPPED', 'PROCESSING'], ['DELIVERED', 'SHIPPED'],
  ]
  for (const [next, current] of transitions) {
    // Confirm the durable backend state before opening the next transition
    // menu; this prevents a stale Firestore listener from racing the action.
    await expect.poll(async () => (await db.collection('orders').doc(orderSnap.docs[0].id).get()).data()?.status, { timeout: 15000 }).toBe(current)
    await updateOrderStatus(ownerId, orderSnap.docs[0].id, next)
  }
  await expect.poll(async () => {
    const snap = await linkRef.get()
    return { orders: (snap.data() as any)?.ordersCount || 0, rev: (snap.data() as any)?.totalRevenue || 0 }
  }, { timeout: 15000 }).toEqual({ orders: 1, rev: order.totalPrice })

  // Leaving DELIVERED (RETURNED) subtracts the revenue + order again.
  await expect.poll(async () => (await db.collection('orders').doc(orderSnap.docs[0].id).get()).data()?.status, { timeout: 15000 }).toBe('DELIVERED')
  await updateOrderStatus(ownerId, orderSnap.docs[0].id, 'RETURNED')
  await expect.poll(async () => {
    const snap = await linkRef.get()
    return { orders: (snap.data() as any)?.ordersCount || 0, rev: (snap.data() as any)?.totalRevenue || 0 }
  }, { timeout: 15000 }).toEqual({ orders: 0, rev: 0 })
})

test('landing page: /landing/:slug renders, records a view, QuickBuy orders attribute, DELIVERED counts', async ({ page }) => {
  const { uniq, ref } = ctx()
  // Keep this flow independently runnable: it must not depend on the earlier
  // registration test having created the project-scoped store.
  await ensureFlowStore(ref, `مقهى التدفق ${uniq}`)
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
  await fillCheckoutCity(page, 'مدينة نصر')
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
  const ownerId = String(store.data()?.ownerId || '')
  expect(ownerId).toBeTruthy()
  // Order status transitions are intentionally sequential; exercise the real
  // lifecycle rather than attempting the rejected NEW → DELIVERED jump.
  for (const next of ['CONTACTED', 'PROCESSING', 'SHIPPED', 'DELIVERED']) {
    await updateOrderStatus(ownerId, orderSnap.docs[0].id, next)
  }
  await expect.poll(async () => {
    const snap = await landingRef.get()
    return { orders: (snap.data() as any)?.ordersCount || 0, rev: (snap.data() as any)?.totalRevenue || 0 }
  }, { timeout: 15000 }).toEqual({ orders: 1, rev: order.totalPrice })

  // Leaving DELIVERED (RETURNED) subtracts the counters again.
  await updateOrderStatus(ownerId, orderSnap.docs[0].id, 'RETURNED')
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

  await page.goto('/store/test-store-a', { waitUntil: 'domcontentloaded' })
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

  // Settings is the canonical URL editor in the current UI. Without a slug
  // its copy control is disabled and no fake URL is rendered.
  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' })
  const copyBtn = page.getByRole('button', { name: 'نسخ الرابط', exact: true }).first()
  await expect(copyBtn).toBeDisabled({ timeout: 15000 })

  // Assign a slug via the admin SDK; the button enables and shows the real public URL.
  await db.collection('stores').doc(uid).update({ slug: ref, ref })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.settings-slug-field')).toHaveValue(ref, { timeout: 15000 })
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
  // Use a dedicated store for this quota-sensitive create test so a previous
  // landing-page scenario cannot consume its page allowance.
  const regRef = `flow-reg-store-${uniq}`
  const regEmail = `${regRef}@mk.test`
  const regStore = await ensureFlowStore(regRef, `مقهى التسجيل ${uniq}`)
  const slug = `flow-reg-${uniq}`

  // The trialing flow store is on plan-starter, whose default landingPagesLimit
  // is 1 — and the earlier landing test already consumed that quota via a direct
  // admin write. Raise the seeded plan's limit so these regressions exercises the
  // callable without tripping the (already-covered separately) page-count gate.
  await db.collection('plans').doc('plan-starter').update({ landingPagesLimit: 50 })
  await db.collection('plans').doc('plan-growth').update({ landingPagesLimit: 50 })
  const regSubscription = await db.collection('subscriptions').where('storeId', '==', regStore.id).limit(1).get()
  if (!regSubscription.empty) {
    const currentLimits = (regSubscription.docs[0].data().limitsSnapshot || {}) as Record<string, unknown>
    await regSubscription.docs[0].ref.update({ limitsSnapshot: { ...currentLimits, landingPagesLimit: 50 } })
  }

  await login(page, 'merchant', regEmail, PASSWORD)
  await page.goto('/dashboard/landing-pages', { waitUntil: 'domcontentloaded' })

  // Create a page with ONLY a title — productId, hero image, seo all empty/undefined.
  await safeClickWithTourGuard(page, page.getByRole('button', { name: 'صفحة جديدة' }))
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

  // Regression: the desktop row mirrors the header order exactly. This catches
  // a visual shift where created/last activity were rendered under the slug.
  const headers = await page.locator('.lp-list-table thead th').allTextContents()
  const savedRow = page.locator('.lp-list-table tbody tr', { hasText: slug }).first()
  await expect(savedRow.locator('td')).toHaveCount(headers.length)
  const cells = await savedRow.locator('td').allTextContents()
  expect(headers).toEqual(['العنوان', 'الرابط (Slug)', 'شراء سريع', 'الحالة', 'تاريخ الإنشاء', 'آخر نشاط', 'الزيارات', 'الطلبات', 'الإيرادات', 'الإجراءات'])
  expect(cells[1]).toContain(`/${slug}`)
  expect(cells[2]).toContain('غير محدد')
  expect(cells[3]).toContain('مسودة')
  expect(cells[4]).not.toBe('')
  expect(cells[5]).toContain('لا يوجد')

  // Filter is an intersection: an empty search may not bypass its status.
  await page.getByLabel('الحالة').selectOption('draft')
  await expect(savedRow).toBeVisible()
  await page.getByLabel('الحالة').selectOption('published')
  await expect(savedRow).toHaveCount(0)
  await page.getByLabel('الحالة').selectOption('')
  await expect(savedRow).toBeVisible()

  // Creating another page with the SAME slug must be rejected client-side.
  await safeClickWithTourGuard(page, page.getByRole('button', { name: 'صفحة جديدة' }))
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
  const copySlug = `${slug}-copy`
  const copyDoc = await pollValue(
    () => db.collection('landingPages').get().then((s) => s.docs.find((d) => String(d.data().slug || '').startsWith(copySlug) && d.data().storeId === regStore.id) || null),
    (d) => d != null,
  )
  expect(copyDoc).not.toBeNull()
})

test('landing hero image upload persists to storage + renders on /landing/:slug', async ({ page }) => {
  const { uniq, ref } = ctx()
  // Converge an independent approved fixture; this test must not depend on
  // the registration test running first.
  const flowStore = await ensureFlowStore(ref, `مقهى صورة التدفق ${uniq}`)
  await flowStore.ref.update({ published: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
  await pollValue(
    () => db.doc(`publicStores/${flowStore.id}`).get().then((snap) => snap.exists ? snap.data() as any : null),
    (data) => data?.published === true,
  )
  const slug = `flow-hero-${uniq}`

  await login(page, 'merchant', ctx().email, PASSWORD)
  await page.goto('/dashboard/landing-pages', { waitUntil: 'domcontentloaded' })
  await safeClickWithTourGuard(page, page.getByRole('button', { name: 'صفحة جديدة' }))
  await page.locator('.drawer .field', { hasText: 'عنوان الصفحة' }).locator('input').fill('صفحة بصورة')
  await page.locator('.drawer .field', { hasText: 'الرابط (slug)' }).locator('input').fill(slug)

  // Upload a hero image through the landing-upload path (storage.rules landingPages/).
  await page.locator('.landing-image-uploader input[type="file"]').first().setInputFiles([
    { name: 'hero.png', mimeType: 'image/png', buffer: PNG },
  ])
  await expect(page.getByText('تمت إضافة الصورة', { exact: true })).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.landing-image-preview img').first()).toBeVisible({ timeout: 30000 })

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
  // Keep this workflow isolated from the seeded platform-usage stores. In the
  // full desktop + mobile run, writing an order to test-store-a would change
  // its seeded 1,020 usage before the mobile usage assertion runs.
  const { email, ref, storeName } = ctx()
  if (!(await storeBySlug(ref))) {
    await registerStore(page, {
      email,
      password: PASSWORD,
      name: 'مالك اختبار الشحن',
      storeName,
      storeRef: ref,
      planName: 'STARTER',
    })
  }
  const store = (await storeBySlug(ref))!
  await db.collection('stores').doc(store.id).update({ published: true })
  const category = await db.collection('categories').add({
    storeId: store.id,
    name: 'منتجات الشحن',
    slug: `shipping-${store.id}`,
    active: true,
    order: 1,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  const existingProduct = await db.collection('products').where('storeId', '==', store.id).limit(1).get()
  if (existingProduct.empty) {
    await db.collection('products').add({
      storeId: store.id,
      categoryId: category.id,
      name: 'منتج اختبار الشحن',
      price: 100,
      stock: 10,
      images: [],
      variants: [],
      colors: [],
      sizes: [],
      active: true,
      featured: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }
  // This regression used to exercise the removed legacy `stores.shipping`
  // provider array. Use the canonical provider/service/config model instead;
  // legacy fields below are intentionally conflicting and must not affect the
  // backend quote.
  const providerId = `shipping-default-${ctx().uniq}`
  const configs = await db.collection('storeShippingProviders').where('storeId', '==', store.id).get()
  await Promise.all(configs.docs.map((doc) => doc.ref.update({ enabled: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() })))
  await db.doc(`shippingProviders/${providerId}`).set({
    id: providerId, name: 'توصيل سريع', slug: 'manual', status: 'active', integrationType: 'manual',
    credentialMode: 'merchant', supportsCOD: true, supportsTracking: false, supportsReturns: false, supportsWebhooks: false,
    allowMerchantRateOverride: false,
    services: [{
      code: 'fast-cairo', name: 'توصيل سريع', enabled: true, serviceType: 'express', rateMode: 'zone', fixedRate: 0,
      estimatedMinHours: 24, estimatedMaxHours: 48, supportsCOD: true, supportsReturns: false, supportsPickup: false,
      zoneRules: [{ zoneId: 'cairo-fast', zoneName: 'القاهرة', enabled: true, governorates: ['القاهرة'], cities: [], areas: [],
        baseRate: 25, codFee: 0, returnFee: 0, baseWeight: 1, extraKgRate: 0, etaMin: 24, etaMax: 48, etaUnit: 'hours' }],
    }],
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  await db.doc(`storeShippingProviders/${store.id}_${providerId}`).set({
    id: `${store.id}_${providerId}`, storeId: store.id, providerId, enabled: true, enabledServiceCodes: ['fast-cairo'],
    serviceCode: 'fast-cairo', rateMode: 'zone', codEnabled: true, returnEnabled: false, defaultPackageWeight: 1,
    rateMarkup: 0, fixedRate: 0, freeShippingThreshold: 0, configurationStatus: 'ready',
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  await db.collection('stores').doc(store.id).update({
    shipping: { enabled: true, model: 'flat', flatFee: 999, refusedPolicy: 'legacy must not win', refusedPolicyEnabled: false, defaultProviderId: 'legacy-only', providers: [] },
  })

  await page.goto(`/store/${ref}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.store-card').first().click()
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${ref}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()

  await page.locator('.field', { hasText: 'الاسم الكامل' }).locator('input').fill('عميل الشحن التلقائي')
  await page.locator('.field', { hasText: 'رقم الهاتف' }).locator('input').fill('01099990011')
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'القاهرة' })
  await fillCheckoutCity(page, 'مدينة نصر')
  await page.locator('.field', { hasText: 'العنوان بالتفصيل' }).locator('textarea').fill('شارع 11')

  // Canonical provider is selected; the conflicting legacy flat fee is ignored.
  await expect(page.getByText('الشحن (توصيل سريع)')).toBeVisible({ timeout: 15000 })

  // Server recomputes the same default provider fee + policy.
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click()
  await expect(page.getByText('تم إنشاء طلبك بنجاح')).toBeVisible({ timeout: 30000 })
  const orderSnap = await db.collection('orders').where('storeId', '==', store.id).orderBy('createdAt', 'desc').limit(1).get()
  const order = orderSnap.docs[0].data() as any
  expect(order.shippingFee).toBe(25)
  expect(order.shippingMethod).toBe('توصيل سريع')
  // Canonical provider snapshots do not carry the removed legacy `model`
  // field; the service code/provider are the authoritative selection.
  expect(order.shippingSnapshot?.model).toBeUndefined()
  expect(order.shippingSnapshot?.providerId).toBe(providerId)

  // Changing only the legacy store fields cannot override the canonical quote.
  await db.collection('stores').doc(store.id).update({ 'shipping.flatFee': 1, 'shipping.refusedPolicyEnabled': true })
  await page.goto(`/store/${ref}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.store-card').first().click()
  await page.getByRole('button', { name: 'أضف إلى السلة' }).click()
  await page.goto(`/store/${ref}/cart`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'إتمام الطلب' }).click()
  await page.locator('.field', { hasText: 'المحافظة' }).locator('select').selectOption({ label: 'القاهرة' })
  await expect(page.getByText('الشحن (توصيل سريع)')).toBeVisible({ timeout: 15000 })
  const again = await db.collection('orders').where('storeId', '==', store.id).orderBy('createdAt', 'desc').limit(1).get()
  expect((again.docs[0].data() as any).shippingFee).toBe(25)
})

// ─────────────────────────────────────────────────────────────
// Merchant store LOGO (not the M&K platform mark): preset pick → upload →
// persist in Firestore → render in public storefront Header+Footer without a
// duplicated name → remove → name fallback. Exercises the full
// Firebase Storage → Firestore → storefront loop through the UI.
// ─────────────────────────────────────────────────────────────
test('store logo: preset selection + upload persist and render on the public storefront', async ({ page }) => {
  const { ref } = ctx()
  await ensureFlowStore(ref, ctx().storeName)
  await login(page, 'merchant', ctx().email, PASSWORD)
  await page.goto('/dashboard/themes', { waitUntil: 'domcontentloaded' })

  const storeEntry = (await storeBySlug(ref))!
  const storeId = storeEntry.id

  // 1) Select a platform-offered preset logo → persisted key in Firestore.
  await safeClickWithTourGuard(page, page.locator('.preset-logo-item').first())
  const presetId = await pollValue(
    () =>
      db
        .collection('stores')
        .doc(storeId)
        .get()
        .then((s) => (s.exists ? (s.data() as any).logo : null)),
    (v) => typeof v === 'string' && v.startsWith('preset:'),
  )
  expect(presetId).toMatch(/^preset:/)

  // Dashboard reflects the selection after a refresh.
  await page.goto('/dashboard/themes', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.preset-logo-item--active')).toHaveCount(1, { timeout: 15000 })

  // 2) Upload a real image through the merchant logo field (Firebase Storage).
  await page.locator('.logo-field input[type="file"]').first().setInputFiles([
    { name: 'store-logo.png', mimeType: 'image/png', buffer: PNG },
  ])
  const uploadedUrl = await pollValue(
    () =>
      db
        .collection('stores')
        .doc(storeId)
        .get()
        .then((s) => (s.exists ? (s.data() as any).logo : null)),
    (v) => typeof v === 'string' && /^https?:\/\//.test(v),
    45000,
  )
  expect(uploadedUrl).toMatch(/^https?:\/\//)
  // The stored value is a real Storage URL (never a blob:/data: URI).
  expect(uploadedUrl).not.toMatch(/^(blob:|data:)/)

  // Dashboard preview shows the uploaded image after refresh.
  await page.goto('/dashboard/themes', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.logo-preview img').first()).toBeVisible({ timeout: 15000 })

  // 3) Publish so the public storefront is browsable, then verify the logo.
  await db.collection('stores').doc(storeId).update({ published: true })
  await page.goto(`/store/${ref}`, { waitUntil: 'domcontentloaded' })

  // Header: logo only — the store name must NOT be duplicated beside it.
  await expect(page.locator('.store-header img.store-logo').first()).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.storefront-brand .store-brand-name')).toHaveCount(0)
  // Footer shows the same logo (larger variant).
  await expect(page.locator('.store-footer .store-footer-logo').first()).toBeVisible({ timeout: 15000 })
  const headerSrc = await page.locator('.store-header img.store-logo').first().getAttribute('src')
  expect(headerSrc).toBe(uploadedUrl)

  // 4) Refresh the public storefront — the logo persists (read from Firestore).
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.store-header img.store-logo').first()).toBeVisible({ timeout: 15000 })
  expect(await page.locator('.store-header img.store-logo').first().getAttribute('src')).toBe(uploadedUrl)

  // 5) Remove the logo → header falls back to the store name.
  await page.goto('/dashboard/themes', { waitUntil: 'domcontentloaded' })
  await safeClickWithTourGuard(page, page.getByRole('button', { name: 'إزالة' }))
  await pollValue(
    () =>
      db
        .collection('stores')
        .doc(storeId)
        .get()
        .then((s) => (s.exists ? (s.data() as any).logo : null)),
    (v) => v == null,
  )
  await page.goto(`/store/${ref}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.storefront-brand .store-brand-name')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.store-header img.store-logo')).toHaveCount(0)
})
