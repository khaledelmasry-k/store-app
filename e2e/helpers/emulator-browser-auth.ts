import admin from 'firebase-admin'
import type { Page } from '@playwright/test'

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'

if (!admin.apps.length) admin.initializeApp({ projectId: 'mk-store-app' })

// The emulator build exposes this bridge from src/shared/firebase/index.ts so
// browser tests can sign in as an arbitrary seeded uid. Signing in through the
// app's own Auth instance is what makes this helper deterministic: the SDK
// writes its own persistence record, under its own storage key, and only
// resolves once that record is committed. Tests must never hand-write that
// record — the key embeds the build's API key, so a forged record silently
// fails to restore whenever the two disagree.
type EmulatorAuthBridge = {
  signInWithCustomToken: (token: string) => Promise<string>
  signOut: () => Promise<void>
  currentUid: () => string | null
}

const BRIDGE = '__mkEmulatorAuth'

async function waitForAuthBridge(page: Page) {
  try {
    await page.waitForFunction((name) => Boolean((window as any)[name]), BRIDGE, { timeout: 30_000 })
  } catch {
    throw new Error(
      `EMULATOR_AUTH_BRIDGE_MISSING: window.${BRIDGE} was never defined at ${page.url()}. `
      + 'The app under test was not built with VITE_FIREBASE_USE_EMULATOR=true.',
    )
  }
}

async function authenticate(page: Page, uid: string, expectedRole: string, route: string) {
  const customToken = await admin.auth().createCustomToken(uid)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForAuthBridge(page)

  // Each journey test authenticates an intentionally isolated emulator user.
  // Sign out through the SDK first so a session left by an earlier call in the
  // same page cannot keep the router on /login.
  const signedInUid = await page.evaluate(async ({ name, token }) => {
    const bridge = (window as any)[name] as EmulatorAuthBridge
    await bridge.signOut()
    return bridge.signInWithCustomToken(token)
  }, { name: BRIDGE, token: customToken })

  if (signedInUid !== uid) {
    throw new Error(`FIREBASE_SIGN_IN: expected uid=${uid}, got uid=${signedInUid}`)
  }

  // signInWithCustomToken resolves only after the SDK has persisted the user,
  // so the next navigation is guaranteed to restore this session.
  await page.goto(route, { waitUntil: 'domcontentloaded' })

  const shellSelector = expectedRole === 'merchant' ? '.app-shell--dashboard' : '.app-shell--platform'
  try {
    await page.waitForFunction(
      (selector) => {
        const shell = document.querySelector(selector)
        return Boolean(shell && !document.body.innerText.includes('تسجيل الدخول'))
      },
      shellSelector,
      { timeout: 30_000 },
    )
  } catch {
    // Name what the app actually did instead of reporting a bare selector
    // timeout, so an app-side auth regression is never mistaken for a flake.
    const state = await page.evaluate((name) => ({
      url: window.location.href,
      uid: ((window as any)[name] as EmulatorAuthBridge | undefined)?.currentUid() ?? null,
      heading: document.body.innerText.trim().slice(0, 160),
    }), BRIDGE).catch(() => null)
    throw new Error(
      `ROLE_SHELL_MISSING: ${shellSelector} never rendered for uid=${uid} (${expectedRole}). `
      + `page=${state?.url ?? 'unknown'} signedInUid=${state?.uid ?? 'null'} body=${JSON.stringify(state?.heading ?? '')}`,
    )
  }
}

export const authenticateMerchant = (page: Page) => authenticate(page, 'seed-owner-a', 'merchant', '/dashboard')
export const authenticateSuperAdmin = (page: Page) => authenticate(page, 'seed-admin', 'superAdmin', '/platform')
export const authenticateMerchantUid = (page: Page, uid: string) => authenticate(page, uid, 'merchant', '/dashboard')
export const authenticateSuperAdminUid = (page: Page, uid: string) => authenticate(page, uid, 'superAdmin', '/platform')
