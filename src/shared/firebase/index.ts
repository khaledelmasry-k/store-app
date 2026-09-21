import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions'
import { CustomProvider, initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check'
import { createEmulatorAppCheckToken, resolveAppCheckStrategy } from './appCheckPolicy'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyASSp0drLChc2gRDBUk32DGMndHYRezET0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mk-store-app.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mk-store-app',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mk-store-app.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '846841591799',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:846841591799:web:6c7e3961be3dcc461a60f2',
}

export const app: FirebaseApp = initializeApp(config)
export const auth: Auth = getAuth(app)
export const db: Firestore = getFirestore(app)
export const storage: FirebaseStorage = getStorage(app, config.storageBucket)
export const functions: Functions = getFunctions(app)
const appCheckSiteKey = String(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY || '').trim()
const useEmulator = import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true'
const appCheckStrategy = resolveAppCheckStrategy({
  isProduction: import.meta.env.PROD,
  useEmulator,
  siteKey: appCheckSiteKey,
})

// Production remains opt-in until its public site key is supplied. Emulator
// builds use a local CustomProvider so protected callables can be exercised by
// E2E without contacting reCAPTCHA or introducing a production bypass.
const appCheckProvider = appCheckStrategy === 'emulator'
  ? new CustomProvider({
      getToken: async () => ({
        token: createEmulatorAppCheckToken(config.projectId),
        expireTimeMillis: Date.now() + 60 * 60 * 1000,
      }),
    })
  : appCheckStrategy === 'recaptcha-enterprise'
    ? new ReCaptchaEnterpriseProvider(appCheckSiteKey)
    : null

export const appCheck: AppCheck | null = appCheckProvider
  ? initializeAppCheck(app, { provider: appCheckProvider, isTokenAutoRefreshEnabled: true })
  : null
export const firebaseRuntime = {
  mode: import.meta.env.MODE,
  useEmulator,
  projectId: config.projectId,
  appCheckEnabled: Boolean(appCheck),
  appCheckStrategy,
  // Keep emulator endpoints out of production configuration and bundles.
  // The connection block below is enabled only when the explicit emulator
  // flag is true (local development).
  authEmulatorHost: import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true' ? 'localhost:9099' : '',
  firestoreEmulatorHost: import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true' ? 'localhost:8080' : '',
  functionsEmulatorHost: import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true' ? 'localhost:5001' : '',
  storageEmulatorHost: import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true' ? 'localhost:9199' : '',
  lastAuthErrorCode: null as string | null,
}

export type DevAuthDiagnostic = {
  timestamp: string
  submittedEmail?: string
  stage: string
  authErrorCode?: string
  authErrorMessage?: string
  authRequestTarget?: string
  authHttpStatus?: number
  authSucceeded?: boolean
  uid?: string | null
  profileSucceeded?: boolean
  profileError?: string
  resolvedRole?: string | null
  resolvedStoreIds?: string[]
  redirectTarget?: string
}

export const persistDevAuthDiagnostic = (patch: Partial<DevAuthDiagnostic>) => {
  if (!import.meta.env.DEV) return
  try {
    const previous = JSON.parse(sessionStorage.getItem('mk-dev-auth-diagnostic') || '{}') as DevAuthDiagnostic
    sessionStorage.setItem('mk-dev-auth-diagnostic', JSON.stringify({
      ...previous,
      ...patch,
      timestamp: new Date().toISOString(),
    }))
  } catch {
    // Diagnostics must never interfere with authentication.
  }
}

if (useEmulator) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, 'localhost', 8080)
  connectStorageEmulator(storage, 'localhost', 9199)
  connectFunctionsEmulator(functions, 'localhost', 5001)

  // Development-only connection proof. Never include secrets, tokens, or
  // credentials in diagnostics; this makes stale Vite builds obvious.
  if (import.meta.env.DEV) {
    const authEmulator = (auth as Auth & { config?: { emulator?: { url?: string } } }).config?.emulator
    console.info('[firebase-emulator-config]', {
      mode: import.meta.env.MODE,
      useEmulator: import.meta.env.VITE_FIREBASE_USE_EMULATOR,
      projectId: config.projectId,
      authProjectId: auth.app.options.projectId,
      authEmulator: authEmulator?.url || 'http://localhost:9099',
      firestoreEmulator: 'localhost:8080',
      functionsEmulator: 'localhost:5001',
      storageEmulator: 'localhost:9199',
      authEmulatorConnected: Boolean(authEmulator),
    })
    if (!authEmulator) console.error('[firebase-emulator-config] Auth emulator was not connected before login')
  }
}

export type Role = 'superAdmin' | 'merchant' | 'staff' | 'customer'
