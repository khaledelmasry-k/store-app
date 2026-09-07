import { test, expect, type Page } from '@playwright/test'
import admin from 'firebase-admin'
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithCustomToken, signOut } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'

process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
if (!admin.apps.length) admin.initializeApp({ projectId: 'mk-store-app' })
const adminAuth = admin.auth()
const db = admin.firestore()
const app = initializeApp({ apiKey: 'test', authDomain: 'mk-store-app.firebaseapp.com', projectId: 'mk-store-app' }, `platform-crm-${process.pid}`)
const auth = getAuth(app)
connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
const functions = getFunctions(app)
connectFunctionsEmulator(functions, 'localhost', 5001)

async function callAs(uid: string, name: string, data: Record<string, unknown> = {}) {
  await signOut(auth).catch(() => undefined)
  await signInWithCustomToken(auth, await adminAuth.createCustomToken(uid))
  return httpsCallable(functions, name)(data)
}

async function login(page: Page, role: 'platform' = 'platform', email = 'admin@mk.store', password = 'Admin12345') {
  await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/platform/, { timeout: 15000 })
}

test.describe.configure({ mode: 'serial' })

test('superAdmin opens CRM, KPIs and Merchant 360 load', async ({ page }) => {
  await login(page, 'platform', 'admin@mk.store', 'Admin12345')
  await page.goto('/platform/crm', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'CRM التجار' })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('إجمالي التجار')).toBeVisible()
  const row = page.locator('tbody tr').first()
  await expect(row).toBeVisible({ timeout: 20000 })
  await row.getByRole('button', { name: '360' }).click()
  await expect(page.getByText(/Merchant 360/)).toBeVisible({ timeout: 20000 })
})

test('CRM filters are bounded and stage/plan/status filters do not duplicate rows', async ({ page }) => {
  await login(page)
  await page.goto('/platform/crm', { waitUntil: 'domcontentloaded' })
  const rows = page.locator('tbody tr')
  await expect.poll(() => rows.count(), { timeout: 10000 }).toBeGreaterThan(0)
  expect(await rows.count()).toBeLessThanOrEqual(50)
  await page.getByLabel('المرحلة').selectOption('active')
  expect(await rows.count()).toBeLessThanOrEqual(5)
  await page.getByLabel('المرحلة').selectOption('')
  await page.getByLabel('الخطة').selectOption({ index: 1 })
  await page.getByLabel('حالة الاشتراك').selectOption({ index: 1 })
  expect(await rows.count()).toBeLessThanOrEqual(5)
  await page.getByLabel('الخطة').selectOption('')
  await page.getByLabel('حالة الاشتراك').selectOption('')
  await page.getByRole('textbox', { name: 'بحث' }).fill('owner@a.store')
  await expect(rows).toHaveCount(1)
})

test('platform CRM callable mutations persist server identity, audit events and follow-up completion', async () => {
  const adminUid = 'seed-admin-legacy'
  const merchantId = 'seed-owner-a'
  await expect(callAs(adminUid, 'updatePlatformMerchantCrm', { merchantId, stage: 'at_risk', tags: ['qa'] })).resolves.toBeTruthy()
  const note = await callAs(adminUid, 'addPlatformMerchantNote', { merchantId, body: 'QA platform note' })
  const noteId = (note.data as any).id
  expect((await db.doc(`platformMerchantCrm/${merchantId}/notes/${noteId}`).get()).data()?.createdBy).toBe(adminUid)
  const follow = await callAs(adminUid, 'upsertPlatformMerchantFollowUp', { merchantId, title: 'QA follow-up', assignedTo: adminUid })
  const followId = (follow.data as any).id
  await callAs(adminUid, 'upsertPlatformMerchantFollowUp', { merchantId, id: followId, title: 'QA follow-up', assignedTo: adminUid, status: 'done' })
  const followData = (await db.doc(`platformMerchantCrm/${merchantId}/followUps/${followId}`).get()).data()
  expect(followData?.status).toBe('done')
  expect(followData?.completedAt).toBeTruthy()
  const events = (await db.collection('auditLogs').where('resourceId', '==', merchantId).get()).docs.map((d) => d.data().action)
  expect(events).toEqual(expect.arrayContaining(['crm_stage_changed', 'crm_note_added', 'crm_followup_created', 'crm_followup_completed']))
})

test('platform CRM RBAC denies unauthenticated, merchant, staff and customer callers', async () => {
  for (const uid of ['seed-owner-a', 'seed-staff-a', 'seed-customer']) {
    await expect(callAs(uid, 'getPlatformCrmDashboard')).rejects.toMatchObject({ code: expect.stringContaining('permission-denied') })
  }
  await signOut(auth)
  await expect(httpsCallable(functions, 'getPlatformCrmDashboard')({})).rejects.toMatchObject({ code: expect.stringContaining('unauthenticated') })
  await expect(callAs('seed-admin-legacy', 'getPlatformMerchant360', { merchantId: 'seed-owner-b' })).resolves.toBeTruthy()
  await expect(callAs('seed-admin-legacy', 'getPlatformMerchant360', { merchantId: 'not-a-merchant' })).rejects.toMatchObject({ code: expect.stringContaining('not-found') })
})
