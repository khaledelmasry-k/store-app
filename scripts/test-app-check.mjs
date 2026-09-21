import assert from 'node:assert/strict'
import admin from 'firebase-admin'
import { createEmulatorAppCheckToken, resolveAppCheckStrategy } from '../src/shared/firebase/appCheckPolicy.ts'

const projectId = process.env.GCLOUD_PROJECT || 'mk-store-app'
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const functionsHost = '127.0.0.1:5001'
const baseUrl = `http://${functionsHost}/${projectId}/us-central1`
let passed = 0

async function check(name, fn) {
  await fn()
  passed++
  console.log(`PASS ${name}`)
}

function errorCode(response) {
  return response.body?.error?.status
}

async function callable(name, { authToken, appCheckToken, data = {} } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (authToken) headers.authorization = `Bearer ${authToken}`
  if (appCheckToken) headers['x-firebase-appcheck'] = appCheckToken
  const response = await fetch(`${baseUrl}/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
  })
  return { status: response.status, body: await response.json() }
}

if (!admin.apps.length) admin.initializeApp({ projectId })

const signInResponse = await fetch(
  `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'appcheck-admin@mk.test', password: 'AppCheck12345!', returnSecureToken: true }),
  },
)
assert.equal(signInResponse.status, 200, 'failed to create the focused-test identity in Auth emulator')
const { idToken, localId } = await signInResponse.json()
assert.ok(idToken)
assert.ok(localId)
await admin.firestore().doc(`users/${localId}`).set({
  uid: localId,
  email: 'appcheck-admin@mk.test',
  role: 'superAdmin',
  active: true,
  storeIds: [],
})

const validAppCheckToken = createEmulatorAppCheckToken(projectId)

await check('emulator strategy overrides PROD and a site key', () => {
  assert.equal(resolveAppCheckStrategy({ isProduction: true, useEmulator: true, siteKey: 'must-not-run-recaptcha' }), 'emulator')
})
await check('production with a site key uses reCAPTCHA Enterprise', () => {
  assert.equal(resolveAppCheckStrategy({ isProduction: true, useEmulator: false, siteKey: 'public-site-key' }), 'recaptcha-enterprise')
})
await check('production without a site key preserves disabled behavior', () => {
  assert.equal(resolveAppCheckStrategy({ isProduction: true, useEmulator: false, siteKey: '' }), 'disabled')
})
await check('development outside the emulator does not start reCAPTCHA', () => {
  assert.equal(resolveAppCheckStrategy({ isProduction: false, useEmulator: false, siteKey: 'public-site-key' }), 'disabled')
})

await check('missing Auth and App Check is denied', async () => {
  const result = await callable('suspendMerchant')
  assert.equal(result.status, 401)
  assert.equal(errorCode(result), 'UNAUTHENTICATED')
})
await check('Auth-only request is denied by App Check', async () => {
  const result = await callable('suspendMerchant', { authToken: idToken })
  assert.equal(result.status, 401)
  assert.equal(errorCode(result), 'UNAUTHENTICATED')
})
await check('invalid App Check token is denied', async () => {
  const result = await callable('suspendMerchant', { authToken: idToken, appCheckToken: 'invalid-token' })
  assert.equal(result.status, 401)
  assert.equal(errorCode(result), 'UNAUTHENTICATED')
})
await check('wrong emulator App Check app identity is denied', async () => {
  const result = await callable('suspendMerchant', {
    authToken: idToken,
    appCheckToken: createEmulatorAppCheckToken('different-project'),
  })
  assert.equal(result.status, 401)
  assert.equal(errorCode(result), 'UNAUTHENTICATED')
})
await check('valid App Check and Auth reach suspendMerchant validation', async () => {
  const result = await callable('suspendMerchant', { authToken: idToken, appCheckToken: validAppCheckToken })
  assert.equal(result.status, 400)
  assert.equal(errorCode(result), 'INVALID_ARGUMENT')
})
await check('reactivateMerchant also denies Auth-only requests', async () => {
  const result = await callable('reactivateMerchant', { authToken: idToken })
  assert.equal(result.status, 401)
  assert.equal(errorCode(result), 'UNAUTHENTICATED')
})
await check('valid App Check and Auth reach reactivateMerchant validation', async () => {
  const result = await callable('reactivateMerchant', { authToken: idToken, appCheckToken: validAppCheckToken })
  assert.equal(result.status, 400)
  assert.equal(errorCode(result), 'INVALID_ARGUMENT')
})
await check('public callable remains usable without App Check', async () => {
  const result = await callable('getPublicPlatformConfig')
  assert.equal(result.status, 200)
  assert.equal(result.body?.error, undefined)
})
await check('public callable remains exempt from invalid App Check enforcement', async () => {
  const result = await callable('getPublicPlatformConfig', { appCheckToken: 'invalid-token' })
  assert.equal(result.status, 200)
  assert.equal(result.body?.error, undefined)
})

console.log(`App Check focused tests: ${passed} passed, 0 failed`)
