import { test, expect, type Page } from '@playwright/test'
import admin from 'firebase-admin'

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
if (!admin.apps.length) admin.initializeApp({ projectId: 'mk-store-app' })

const adminAuth = admin.auth()
const db = admin.firestore()
const password = 'Verify12345'

function uniqueEmail() {
  return `verify-${Date.now()}@mk.test`
}

async function login(page: Page, email: string, pass: string, role = 'merchant') {
  await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded' })
  await page.locator('#auth-email').fill(email)
  await page.locator('#auth-password').fill(pass)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
}

async function clickButtonContaining(page: Page, label: string) {
  await page.evaluate((needle) => {
    const button = Array.from(document.querySelectorAll('button')).find((item) => (item.textContent || '').includes(needle)) as HTMLButtonElement | undefined
    if (!button) throw new Error(`Button not found: ${needle}`)
    button.click()
  }, label)
}

async function waitForAdminUser(email: string) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      return await adminAuth.getUserByEmail(email)
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error(`Timed out waiting for Firebase user ${email}`)
}

async function waitForMerchantProfile(uid: string) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    const snapshot = await db.doc(`users/${uid}`).get()
    const profile = snapshot.data()
    if (profile?.emailVerificationRequired === true) return profile
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for merchant profile ${uid}`)
}

test.describe.configure({ mode: 'serial' })

test('A: new merchant registration creates an unverified gated account and resend cooldown is UI-only', async ({ page }) => {
  const email = uniqueEmail()
  const ref = `verify-${Date.now()}`
  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  const inputs = page.locator('.auth-card input')
  await inputs.nth(0).fill('تاجر تحقق')
  await inputs.nth(1).fill('01012345678')
  await inputs.nth(2).fill(email)
  await inputs.nth(3).fill(password)
  await page.locator('.auth-terms input[type="checkbox"]').check()
  await page.getByRole('button', { name: 'التالي' }).click()
  await page.locator('.register-plan-pill').filter({ hasText: 'FREE' }).click()
  await page.getByRole('button', { name: 'التالي' }).click()
  await inputs.nth(0).fill('متجر التحقق')
  await inputs.nth(1).fill(ref)
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click()

  const authUser = await waitForAdminUser(email)
  await waitForMerchantProfile(authUser.uid)
  await expect(page).toHaveURL(/\/verify-email/, { timeout: 30000 })
  await expect(page.getByRole('heading', { name: 'تحقق من بريدك الإلكتروني' })).toBeVisible()
  expect(authUser.emailVerified).toBe(false)

  await page.goto('/dashboard/', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/verify-email/)

  await expect(page.getByRole('button', { name: 'إعادة إرسال رسالة التحقق' })).toBeEnabled()
  await clickButtonContaining(page, 'إعادة إرسال رسالة التحقق')
  await expect(page.getByText(/إعادة الإرسال بعد 60 ثانية/)).toBeVisible()

  const resendButton = page.getByRole('button', { name: /إعادة الإرسال بعد 60 ثانية/ })
  await expect(resendButton).toBeDisabled()
  await expect(page.getByRole('button', { name: /تحققت من البريد/ })).toBeVisible()
})

test('B: Admin verification update plus Firebase reload unlocks the new merchant dashboard', async ({ page }) => {
  const email = uniqueEmail()
  const authUser = await adminAuth.createUser({ email, password, emailVerified: false })
  await db.doc(`users/${authUser.uid}`).set({
    uid: authUser.uid,
    email,
    name: 'تاجر تحقق مكتمل',
    role: 'merchant',
    storeIds: [],
    active: true,
    merchantStatus: 'active',
    emailVerificationRequired: true,
  })

  await login(page, email, password)
  await expect(page).toHaveURL(/\/verify-email/, { timeout: 15000 })
  await clickButtonContaining(page, 'تحققت من البريد')
  await expect(page.getByText(/لم يكتمل التحقق بعد/)).toBeVisible()

  await adminAuth.updateUser(authUser.uid, { emailVerified: true })
  await clickButtonContaining(page, 'تحققت من البريد')
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
})

test('compatibility: legacy merchant without rollout flag enters dashboard', async ({ page }) => {
  await login(page, 'owner@a.store', 'Owner12345')
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
})

test('compatibility: super admin remains unaffected', async ({ page }) => {
  await page.goto('/login?role=platform', { waitUntil: 'domcontentloaded' })
  await page.locator('#auth-email').fill('khaaledelmasry@gmail.com')
  await page.locator('#auth-password').fill('Admin12345')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page).toHaveURL(/\/platform/, { timeout: 15000 })
})

test('compatibility: staff and forgot-password remain unaffected', async ({ page }) => {
  await page.goto('/login?role=merchant', { waitUntil: 'domcontentloaded' })
  await page.locator('#auth-email').fill('staff@test.com')
  await page.locator('#auth-password').fill('Staff12345')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

  await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'نسيت كلمة المرور' })).toBeVisible()
})
