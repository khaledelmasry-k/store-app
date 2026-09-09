import admin from 'firebase-admin'
import type { Page } from '@playwright/test'

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'

if (!admin.apps.length) admin.initializeApp({ projectId: 'mk-store-app' })

const API_KEY = 'AIzaSyASSp0drLChc2gRDBUk32DGMndHYRezET0'
const AUTH_EMULATOR = 'http://127.0.0.1:9099'

type EmulatorAuthState = {
  uid: string
  email?: string
  displayName?: string
  idToken: string
  refreshToken: string
  expiresIn: string
  localId: string
  registered?: boolean
  customToken: string
}

async function issueEmulatorState(uid: string): Promise<EmulatorAuthState> {
  const customToken = await admin.auth().createCustomToken(uid)
  const response = await fetch(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  })
  if (!response.ok) throw new Error(`TOKEN_CREATION: emulator signInWithCustomToken returned ${response.status} ${await response.text()}`)
  return response.json().then((payload) => ({ ...payload, customToken })) as Promise<EmulatorAuthState>
}

async function authenticate(page: Page, uid: string, expectedRole: string, route: string) {
  const state = await issueEmulatorState(uid)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => !!(window as any).__FIREBASE_AUTH__, null, { timeout: 10000 }).catch(() => {})
  await page.waitForFunction(() => !!(window as any).__FIREBASE_SIGNIN__, null, { timeout: 10000 }).catch(() => {})
  await page.evaluate(async (token) => {
    const auth: any = (window as any).__FIREBASE_AUTH__
    const signIn: any = (window as any).__FIREBASE_SIGNIN__
    if (!auth) throw new Error('FIREBASE_AUTH not exposed - ensure vite dev server and emulator flag')
    if (signIn) {
      await signIn(auth, token)
    } else {
      const mod: any = await import('/node_modules/.vite/deps/firebase_auth.js').catch(() => null)
      if (mod?.signInWithCustomToken) await mod.signInWithCustomToken(auth, token)
      else {
        const m2: any = await import('firebase/auth').catch(() => null)
        if (m2?.signInWithCustomToken) await m2.signInWithCustomToken(auth, token)
        else throw new Error('signInWithCustomToken not available')
      }
    }
    if (!auth.currentUser) throw new Error('FIREBASE_SIGN_IN: currentUser missing after signInWithCustomToken')
  }, state.customToken)
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.locator(expectedRole === 'merchant' ? '.app-shell--dashboard' : '.app-shell--platform').waitFor({ state: 'visible' })
  await page.waitForFunction((role) => {
    const shell = document.querySelector(role === 'merchant' ? '.app-shell--dashboard' : '.app-shell--platform')
    return Boolean(shell && !document.body.innerText.includes('تسجيل الدخول'))
  }, expectedRole)
  const identity = await page.evaluate(async () => {
    const auth: any = (window as any).__FIREBASE_AUTH__
    return { uid: auth?.currentUser?.uid || null }
  })
  if (identity.uid !== uid) {
    throw new Error(`FIREBASE_SIGN_IN: expected uid=${uid}, got uid=${identity.uid}`)
  }
}

export const authenticateMerchant = (page: Page) => authenticate(page, 'seed-owner-a', 'merchant', '/dashboard')
export const authenticateSuperAdmin = (page: Page) => authenticate(page, 'seed-admin', 'superAdmin', '/platform')
export const authenticateMerchantUid = (page: Page, uid: string) => authenticate(page, uid, 'merchant', '/dashboard')
export const authenticateSuperAdminUid = (page: Page, uid: string) => authenticate(page, uid, 'superAdmin', '/platform')
