import { test, expect } from '@playwright/test'
import admin from 'firebase-admin'
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { connectFirestoreEmulator, deleteDoc, doc, getFirestore } from 'firebase/firestore'

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199'

if (!admin.apps.length) admin.initializeApp({ projectId: 'mk-store-app', storageBucket: 'mk-store-app.firebasestorage.app' })
const db = admin.firestore()
const adminAuth = admin.auth()
const bucket = admin.storage().bucket('mk-store-app.firebasestorage.app')

const clientApp = initializeApp({
  apiKey: 'any',
  authDomain: 'mk-store-app.firebaseapp.com',
  projectId: 'mk-store-app',
  storageBucket: 'mk-store-app.firebasestorage.app',
}, `merchant-lifecycle-${process.pid}`)
const clientAuth = getAuth(clientApp)
connectAuthEmulator(clientAuth, 'http://localhost:9099', { disableWarnings: true })
const clientFunctions = getFunctions(clientApp)
connectFunctionsEmulator(clientFunctions, 'localhost', 5001)
const clientDb = getFirestore(clientApp)
connectFirestoreEmulator(clientDb, 'localhost', 8080)

async function callAs(uid: string, name: string, data: Record<string, unknown> = {}) {
  const token = await adminAuth.createCustomToken(uid)
  await signInWithCustomToken(clientAuth, token)
  return httpsCallable(clientFunctions, name)(data)
}

async function createMerchantFixture(prefix: string, opts: { published?: boolean; test?: boolean } = {}) {
  const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const merchantId = `${prefix}-merchant-${uniq}`
  const storeId = `${prefix}-store-${uniq}`
  const staffId = `${prefix}-staff-${uniq}`
  const customerId = `${prefix}-customer-${uniq}`
  const trialEndsAt = admin.firestore.Timestamp.fromMillis(Date.now() + 2 * 86400000)
  await adminAuth.createUser({ uid: merchantId, email: `${merchantId}@mk.test`, password: 'Owner12345' })
  await adminAuth.createUser({ uid: staffId, email: `${staffId}@mk.test`, password: 'Staff12345' })
  await adminAuth.createUser({ uid: customerId, email: `${customerId}@mk.test`, password: 'Customer12345' })
  await db.doc(`users/${merchantId}`).set({ uid: merchantId, email: `${merchantId}@mk.test`, name: 'تاجر دورة الحياة', role: 'merchant', active: true, merchantStatus: 'active', storeIds: [storeId] })
  await db.doc(`users/${staffId}`).set({ uid: staffId, email: `${staffId}@mk.test`, name: 'موظف التاجر', role: 'staff', active: true, storeIds: [storeId] })
  await db.doc(`users/${customerId}`).set({ uid: customerId, email: `${customerId}@mk.test`, name: 'عميل عالمي', role: 'customer', active: true, storeIds: [] })
  await db.doc(`stores/${storeId}`).set({
    id: storeId, name: 'متجر حذف آمن', slug: storeId, ownerId: merchantId, active: true,
    published: opts.published === true, storeStatus: opts.published === true ? 'published' : 'draft',
    isTestMerchant: opts.test === true, storageUsed: 4,
  })
  await db.doc(`publicStores/${storeId}`).set({ name: 'متجر حذف آمن', slug: storeId, active: true, published: opts.published === true })
  await db.doc(`publicStores/${storeId}/products/public-product`).set({ storeId, active: true, name: 'منتج عام' })
  await db.doc(`stores/${storeId}/billingSnapshots/snapshot`).set({ storeId, marker: true })
  await db.doc(`stores/${storeId}/usageAlerts/products`).set({ key: 'products', marker: true })

  const fixtureCollections = [
    'subscriptions', 'storePurchaseRequests', 'subscriptionChangeRequests', 'subscriptionPayments',
    'transactions', 'payments', 'orders', 'orderCosts', 'products', 'productCosts', 'categories',
    'customers', 'coupons', 'shipping', 'storeShippingProviders', 'shipments', 'shippingCompanyReviews',
    'storeLinks', 'landingPages', 'analytics', 'notifications', 'tickets', 'auditLogs', 'team', 'roles', 'invitations',
  ]
  for (const collection of fixtureCollections) {
    await db.doc(`${collection}/${prefix}-${uniq}`).set({
      storeId,
      merchantId,
      userId: collection === 'notifications' ? merchantId : null,
      createdBy: collection === 'tickets' ? merchantId : null,
      status: collection === 'subscriptions' ? 'trialing' : 'active',
      trialEndsAt: collection === 'subscriptions' ? trialEndsAt : null,
      marker: true,
    })
  }
  await db.doc(`team/${prefix}-${uniq}`).set({ storeId, userId: staffId, active: true, marker: true }, { merge: true })
  await bucket.file(`stores/${storeId}/logo.txt`).save(Buffer.from('qa-store-logo'))
  await bucket.file(`products/${storeId}/product.txt`).save(Buffer.from('qa-product-image'))
  return { merchantId, storeId, staffId, customerId, trialEndsAt, fixtureCollections }
}

test.describe.configure({ mode: 'serial' })

test('SuperAdmin merchant list exposes working suspend/reactivate and deletion-preview controls', async ({ page }) => {
  // Use an isolated QA merchant instead of the shared seeded owner. Other
  // viewport projects run against the same emulator and must never observe a
  // transient suspend state from this interaction test.
  const fixture = await createMerchantFixture('ui', { published: false, test: true })
  await page.goto('/login?role=platform')
  await page.locator('input[type="email"]').fill('admin@mk.store')
  await page.locator('input[type="password"]').fill('Admin12345')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/platform/)
  await page.goto('/platform/merchants')
  // Filter the table to this fixture so pagination/other parallel fixtures
  // cannot hide the row under the first page.
  await page.getByPlaceholder('بحث بالاسم، الرابط، المالك...').fill(`${fixture.merchantId}@mk.test`)

  const row = () => page.locator('tbody tr').filter({ hasText: `${fixture.merchantId}@mk.test` }).first()
  await expect(row()).toBeVisible({ timeout: 15000 })
  page.once('dialog', (dialog) => dialog.accept())
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/suspendMerchant') && response.request().method() === 'POST'),
    row().getByRole('button', { name: 'إيقاف', exact: true }).click(),
  ])
  await expect.poll(async () => (await db.doc(`users/${fixture.merchantId}`).get()).data()?.merchantStatus, { timeout: 15000 }).toBe('suspended')
  await expect(row().getByRole('button', { name: 'إعادة التفعيل', exact: true })).toBeVisible({ timeout: 15000 })

  page.once('dialog', (dialog) => dialog.accept())
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/reactivateMerchant') && response.request().method() === 'POST'),
    row().getByRole('button', { name: 'إعادة التفعيل', exact: true }).click(),
  ])
  await expect.poll(async () => (await db.doc(`users/${fixture.merchantId}`).get()).data()?.merchantStatus, { timeout: 15000 }).toBe('active')
  await expect(row().getByRole('button', { name: 'إيقاف', exact: true })).toBeVisible({ timeout: 15000 })

  await row().getByRole('button', { name: 'حذف نهائي', exact: true }).click()
  await expect(page.getByText('هذا الإجراء نهائي ولا يمكن التراجع عنه.')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('متجر حذف آمن', { exact: false }).first()).toBeVisible()
  const deleteButton = page.getByRole('button', { name: 'حذف التاجر نهائيًا', exact: true })
  await expect(deleteButton).toBeDisabled()
  // The button stays disabled while the server is still calculating the
  // irreversible deletion impact.  Wait for that preview before entering the
  // confirmation phrase so this assertion verifies the intended safeguard,
  // rather than racing the callable response.
  await expect(page.getByText('المتاجر:', { exact: false })).toBeVisible({ timeout: 15000 })
  const confirmationInput = page.locator('label').filter({ hasText: 'اكتب نص التأكيد: حذف نهائي' }).locator('input').first()
  await confirmationInput.click()
  await confirmationInput.fill('حذف نهائي')
  await expect(confirmationInput).toHaveValue('حذف نهائي')
  await expect(deleteButton).toBeEnabled()
  await page.getByRole('button', { name: 'إلغاء', exact: true }).last().click()
  expect((await db.doc(`users/${fixture.merchantId}`).get()).exists).toBe(true)
  await callAs('seed-admin', 'permanentlyDeleteMerchant', { merchantId: fixture.merchantId, confirmation: 'حذف نهائي' })
})

test('SuperAdmin suspension blocks operations/public commerce and reactivation preserves subscription and publication', async () => {
  const fixture = await createMerchantFixture('lifecycle', { published: true, test: true })
  const originalSub = (await db.collection('subscriptions').where('storeId', '==', fixture.storeId).get()).docs[0]
  const originalTrialEnd = originalSub.data().trialEndsAt.toMillis()

  await callAs('seed-admin', 'suspendMerchant', { merchantId: fixture.merchantId })
  await expect.poll(async () => (await db.doc(`users/${fixture.merchantId}`).get()).data()?.merchantStatus).toBe('suspended')
  const suspendedStore = (await db.doc(`stores/${fixture.storeId}`).get()).data()!
  expect(suspendedStore.merchantSuspended).toBe(true)
  expect(suspendedStore.storeStatus).toBe('published')
  expect((await db.collection('products').where('storeId', '==', fixture.storeId).get()).size).toBe(1)
  await expect.poll(async () => (await db.doc(`publicStores/${fixture.storeId}`).get()).data()?.active).toBe(false)

  let merchantDenied = false
  try {
    await callAs(fixture.merchantId, 'getMerchantSubscription', { storeId: fixture.storeId })
  } catch { merchantDenied = true }
  expect(merchantDenied).toBe(true)

  await callAs('seed-admin', 'reactivateMerchant', { merchantId: fixture.merchantId })
  await expect.poll(async () => (await db.doc(`users/${fixture.merchantId}`).get()).data()?.merchantStatus).toBe('active')
  const restoredStore = (await db.doc(`stores/${fixture.storeId}`).get()).data()!
  expect(restoredStore.merchantSuspended).toBe(false)
  expect(restoredStore.storeStatus).toBe('published')
  const unchangedSub = await originalSub.ref.get()
  expect(unchangedSub.data()?.trialEndsAt.toMillis()).toBe(originalTrialEnd)
  expect(unchangedSub.data()?.status).toBe('trialing')
  await expect.poll(async () => (await db.doc(`publicStores/${fixture.storeId}`).get()).data()?.active).toBe(true)

  await callAs('seed-admin', 'permanentlyDeleteMerchant', { merchantId: fixture.merchantId, confirmation: 'حذف نهائي' })
  await adminAuth.deleteUser(fixture.customerId).catch(() => {})
  await db.doc(`users/${fixture.customerId}`).delete().catch(() => {})
})

test('permanent deletion previews impact, denies non-admin/admin targets, cascades safely and is idempotent', async () => {
  const fixture = await createMerchantFixture('delete', { published: true, test: false })

  let nonAdminDenied = false
  try {
    await callAs(fixture.merchantId, 'getMerchantDeletionPreview', { merchantId: fixture.merchantId })
  } catch { nonAdminDenied = true }
  expect(nonAdminDenied).toBe(true)

  let directDeleteDenied = false
  try {
    await deleteDoc(doc(clientDb, 'users', fixture.merchantId))
  } catch { directDeleteDenied = true }
  expect(directDeleteDenied).toBe(true)
  expect((await db.doc(`users/${fixture.merchantId}`).get()).exists).toBe(true)

  let adminTargetDenied = false
  try {
    await callAs('seed-admin', 'getMerchantDeletionPreview', { merchantId: 'seed-admin' })
  } catch { adminTargetDenied = true }
  expect(adminTargetDenied).toBe(true)

  const preview = await callAs('seed-admin', 'getMerchantDeletionPreview', { merchantId: fixture.merchantId })
  const previewData = preview.data as any
  expect(previewData.status).toBe('ready')
  expect(previewData.counts.stores).toBe(1)
  expect(previewData.counts.products).toBe(1)
  expect(previewData.counts.orders).toBe(1)
  expect(previewData.counts.subscriptions).toBe(1)
  expect(previewData.counts.storageFiles).toBe(2)
  expect(previewData.counts.authUsers).toBe(2)

  let badConfirmationDenied = false
  try {
    await callAs('seed-admin', 'permanentlyDeleteMerchant', { merchantId: fixture.merchantId, confirmation: 'نعم' })
  } catch { badConfirmationDenied = true }
  expect(badConfirmationDenied).toBe(true)

  const deleted = await callAs('seed-admin', 'permanentlyDeleteMerchant', { merchantId: fixture.merchantId, confirmation: 'حذف نهائي' })
  expect((deleted.data as any).status).toBe('deleted')
  expect((await db.doc(`users/${fixture.merchantId}`).get()).exists).toBe(false)
  expect((await db.doc(`users/${fixture.staffId}`).get()).exists).toBe(false)
  expect((await db.doc(`users/${fixture.customerId}`).get()).exists).toBe(true)
  expect((await db.doc(`stores/${fixture.storeId}`).get()).exists).toBe(false)
  expect((await db.doc(`publicStores/${fixture.storeId}`).get()).exists).toBe(false)
  for (const collection of fixture.fixtureCollections) {
    expect((await db.collection(collection).where('storeId', '==', fixture.storeId).get()).empty, collection).toBe(true)
  }
  expect((await bucket.getFiles({ prefix: `stores/${fixture.storeId}/` }))[0]).toHaveLength(0)
  expect((await bucket.getFiles({ prefix: `products/${fixture.storeId}/` }))[0]).toHaveLength(0)
  await expect(adminAuth.getUser(fixture.merchantId)).rejects.toThrow()
  await expect(adminAuth.getUser(fixture.staffId)).rejects.toThrow()
  await expect(adminAuth.getUser(fixture.customerId)).resolves.toBeTruthy()

  const audit = await db.collection('auditLogs').where('action', '==', 'merchant_permanently_deleted').where('resourceId', '==', fixture.merchantId).get()
  expect(audit.size).toBe(1)
  expect((await db.doc(`merchantDeletionJobs/${fixture.merchantId}`).get()).data()?.status).toBe('deleted')

  const second = await callAs('seed-admin', 'permanentlyDeleteMerchant', { merchantId: fixture.merchantId, confirmation: 'حذف نهائي' })
  expect((second.data as any).status).toBe('already_deleted')
  const auditAfterSecond = await db.collection('auditLogs').where('action', '==', 'merchant_permanently_deleted').where('resourceId', '==', fixture.merchantId).get()
  expect(auditAfterSecond.size).toBe(1)

  await adminAuth.deleteUser(fixture.customerId).catch(() => {})
  await db.doc(`users/${fixture.customerId}`).delete().catch(() => {})
  await db.doc(`merchantDeletionJobs/${fixture.merchantId}`).delete().catch(() => {})
  for (const doc of auditAfterSecond.docs) await doc.ref.delete()
})
