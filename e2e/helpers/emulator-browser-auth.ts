import admin from 'firebase-admin'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'

if (!admin.apps.length) admin.initializeApp({ projectId: 'mk-store-app' })

// Match the Vite configuration used by the running test app. The Auth
// emulator accepts public placeholder keys, but IndexedDB persistence is
// keyed by that exact value.
const API_KEY = (() => {
  try {
    return readFileSync('.env.local', 'utf8').match(/^VITE_FIREBASE_API_KEY=(\S+)/m)?.[1]
      || 'AIzaSyASSp0drLChc2gRDBUk32DGMndHYRezET0'
  } catch {
    return 'AIzaSyASSp0drLChc2gRDBUk32DGMndHYRezET0'
  }
})()
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
  const key = `firebase:authUser:${API_KEY}:[DEFAULT]`
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  let ok = false
  try {
    await page.evaluate(async (token) => {
      const firebase: any = await import('/src/shared/firebase/index.ts')
      const mod: any = await import('/node_modules/.vite/deps/firebase_auth.js')
      await mod.signInWithCustomToken(firebase.auth, token)
      if (!firebase.auth.currentUser) throw new Error('FIREBASE_SIGN_IN: currentUser missing after signInWithCustomToken')
    }, state.customToken)
    ok = true
  } catch (e) {
    // Fallback for vite preview (no /src serving) - write directly to indexedDB
    let adminEmail = ''
    let adminDisplay = ''
    try {
      const rec: any = await admin.auth().getUser(uid)
      adminEmail = rec.email || ''
      adminDisplay = rec.displayName || ''
    } catch {}
    const emailVal = adminEmail || (state as any).email || `${uid}@mk.test`
    const displayVal = adminDisplay || emailVal.split('@')[0]
    const expirationTime = Date.now() + Number((state as any).expiresIn || 3600) * 1000
    const value: any = {
      uid,
      email: emailVal,
      emailVerified: true,
      displayName: displayVal,
      isAnonymous: false,
      providerData: [{ providerId: 'password', uid: emailVal, displayName: displayVal, email: emailVal, phoneNumber: null, photoURL: null }],
      stsTokenManager: { refreshToken: (state as any).refreshToken, accessToken: (state as any).idToken, expirationTime },
      createdAt: String(Date.now() - 86400000),
      lastLoginAt: String(Date.now()),
      apiKey: API_KEY,
      appName: '[DEFAULT]',
    }
    await page.evaluate(
      async ({ k, v }: { k: string; v: any }) => {
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('firebaseLocalStorageDb', 1)
          const t = setTimeout(() => reject(new Error('indexedDB open timeout')), 5000)
          req.onupgradeneeded = () => {
            try {
              if (!req.result.objectStoreNames.contains('firebaseLocalStorage')) req.result.createObjectStore('firebaseLocalStorage')
            } catch {}
          }
          req.onsuccess = () => {
            clearTimeout(t)
            const db: any = req.result
            try {
              const tx = db.transaction('firebaseLocalStorage', 'readwrite')
              const store: any = tx.objectStore('firebaseLocalStorage')
              const put: any = store.put({ fbase_key: k, value: v })
              put.onerror = () => reject(put.error)
              tx.oncomplete = () => { db.close(); resolve() }
              tx.onerror = () => reject(tx.error)
            } catch (e) { reject(e) }
          }
          req.onerror = () => { clearTimeout(t); reject(req.error) }
        })
      },
      { k: key, v: value }
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    ok = true
  }
  if (!ok) throw new Error('authenticate failed')
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.locator(expectedRole === 'merchant' ? '.app-shell--dashboard' : '.app-shell--platform').waitFor({ state: 'visible' })
  await page.waitForFunction((role) => {
    const shell = document.querySelector(role === 'merchant' ? '.app-shell--dashboard' : '.app-shell--platform')
    return Boolean(shell && !document.body.innerText.includes('تسجيل الدخول'))
  }, expectedRole)
  const identity = await page.evaluate(async (k) => {
    // Try window global first (if production had it), then fallback to indexedDB
    const wAuth: any = (window as any).__FIREBASE_AUTH__
    if (wAuth?.currentUser?.uid) return { uid: wAuth.currentUser.uid }
    try {
      const firebase: any = await import('/src/shared/firebase/index.ts')
      if (firebase.auth?.currentUser?.uid) return { uid: firebase.auth.currentUser.uid }
    } catch {}
    // Fallback to indexedDB for vite preview
    return new Promise<{ uid: string | null }>((resolve) => {
      const req: any = indexedDB.open('firebaseLocalStorageDb', 1)
      req.onsuccess = () => {
        const db: any = req.result
        if (!db.objectStoreNames.contains('firebaseLocalStorage')) { resolve({ uid: null }); return }
        const tx: any = db.transaction('firebaseLocalStorage', 'readonly')
        const store: any = tx.objectStore('firebaseLocalStorage')
        const get: any = store.get(k)
        get.onsuccess = () => resolve({ uid: get.result?.value?.uid || null })
        get.onerror = () => resolve({ uid: null })
      }
      req.onerror = () => resolve({ uid: null })
    })
  }, key)
  if (identity.uid !== uid) {
    throw new Error(`FIREBASE_SIGN_IN: expected uid=${uid}, got uid=${identity.uid}`)
  }
}

export const authenticateMerchant = (page: Page) => authenticate(page, 'seed-owner-a', 'merchant', '/dashboard')
export const authenticateSuperAdmin = (page: Page) => authenticate(page, 'seed-admin', 'superAdmin', '/platform')
export const authenticateMerchantUid = (page: Page, uid: string) => authenticate(page, uid, 'merchant', '/dashboard')
export const authenticateSuperAdminUid = (page: Page, uid: string) => authenticate(page, uid, 'superAdmin', '/platform')
