// Emulator-only security regression checks for session-scoped impersonation.
import admin from 'firebase-admin'

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || ''
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || ''
if (!/^(localhost|127\.0\.0\.1):/.test(firestoreHost) || !/^(localhost|127\.0\.0\.1):/.test(authHost)) {
  throw new Error('Refusing to run outside local Firebase emulators')
}
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'mk-store-app' })
const db = admin.firestore()
const auth = admin.auth()
const project = process.env.GCLOUD_PROJECT || 'mk-store-app'
const apiKey = 'AIzaSyASSp0drLChc2gRDBUk32DGMndHYRezET0'
const callable = `http://127.0.0.1:5001/${project}/us-central1`
const adminUid = 'security-admin'
const merchantUid = 'security-merchant'
const storeId = 'security-store'

async function exchange(customToken) {
  const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  })
  if (!response.ok) throw new Error(`auth exchange failed: ${response.status}`)
  return (await response.json()).idToken
}

async function idToken(uid, claims = {}) {
  return exchange(await auth.createCustomToken(uid, claims))
}

async function call(name, token, data = {}) {
  const response = await fetch(`${callable}/${name}`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  const body = await response.json()
  return { response, body }
}

const expectDenied = async (name, token, data) => {
  const result = await call(name, token, data)
  if (result.response.ok || result.body?.error?.status !== 'PERMISSION_DENIED') throw new Error(`${name} was not denied`)
}

async function seed() {
  for (const [uid, email, role] of [[adminUid, 'security-admin@mk.test', 'superAdmin'], [merchantUid, 'security-merchant@mk.test', 'merchant']]) {
    try { await auth.createUser({ uid, email, password: 'Security-only-123!', emailVerified: true }) } catch {}
    await db.doc(`users/${uid}`).set({ uid, email, name: role, role, active: true, storeIds: role === 'merchant' ? [storeId] : [] })
  }
  await db.doc(`stores/${storeId}`).set({ ownerId: merchantUid, name: 'Security Test Store', slug: 'security-test-store', active: true, published: false })
}

async function main() {
  await seed()
  const adminToken = await idToken(adminUid)
  const merchantToken = await idToken(merchantUid)

  // A/I/H: stale profile fields have no authorization effect.
  await db.doc(`users/${merchantUid}`).update({ impersonatedBy: adminUid, impersonatedUntil: admin.firestore.Timestamp.fromMillis(Date.now() + 900000), impersonatedStoreId: storeId, impersonatedMerchantId: merchantUid })
  await expectDenied('exitImpersonation', merchantToken)
  const normalClaims = await auth.verifyIdToken(merchantToken)
  if (normalClaims.supportImpersonation === true) throw new Error('normal merchant received support claim')

  // B/C/J: start a legitimate session and verify claims, record, and secure exit.
  const started = await call('impersonate', adminToken, { storeId })
  if (!started.response.ok || !started.body?.result?.customToken) throw new Error('impersonate did not return a token')
  const supportToken = await exchange(started.body.result.customToken)
  const supportClaims = await auth.verifyIdToken(supportToken)
  if (supportClaims.supportImpersonation !== true || !supportClaims.supportSessionId) throw new Error('support claims missing')
  const sessionRef = db.doc(`supportImpersonationSessions/${supportClaims.supportSessionId}`)
  const session = (await sessionRef.get()).data()
  if (!session || session.status !== 'active' || session.adminUid !== adminUid || session.storeId !== storeId) throw new Error('active support session missing')
  const ended = await call('exitImpersonation', supportToken)
  if (!ended.response.ok || !ended.body?.result?.customToken) throw new Error('secure exit failed')
  const endedAdminToken = await idToken(adminUid)
  const endedClaims = await auth.verifyIdToken(endedAdminToken)
  if (endedClaims.supportImpersonation === true) throw new Error('admin token retained support claim')
  if ((await sessionRef.get()).data()?.status !== 'ended') throw new Error('session was not ended')
  await expectDenied('exitImpersonation', supportToken)

  // D: an expired signed session cannot mint an administrator token.
  const expiredSession = `expired-${Date.now()}`
  await db.doc(`supportImpersonationSessions/${expiredSession}`).set({ sessionId: expiredSession, adminUid, merchantUid, storeId, status: 'active', createdAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1000) })
  await expectDenied('exitImpersonation', await idToken(merchantUid, { supportImpersonation: true, supportSessionId: expiredSession, supportAdminUid: adminUid, supportMerchantUid: merchantUid, supportStoreId: storeId, supportExpiresAt: Date.now() - 1000 }))

  // F/G: wrong session and removed admin are denied.
  const badSession = `bad-${Date.now()}`
  await db.doc(`supportImpersonationSessions/${badSession}`).set({ sessionId: badSession, adminUid, merchantUid, storeId, status: 'active', createdAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 600000) })
  await expectDenied('exitImpersonation', await idToken(merchantUid, { supportImpersonation: true, supportSessionId: badSession, supportAdminUid: 'wrong-admin', supportMerchantUid: merchantUid, supportStoreId: storeId, supportExpiresAt: Date.now() + 600000 }))
  await db.doc(`users/${adminUid}`).update({ role: 'merchant' })
  const removedAdminSession = `removed-${Date.now()}`
  await db.doc(`supportImpersonationSessions/${removedAdminSession}`).set({ sessionId: removedAdminSession, adminUid, merchantUid, storeId, status: 'active', createdAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 600000) })
  await expectDenied('exitImpersonation', await idToken(merchantUid, { supportImpersonation: true, supportSessionId: removedAdminSession, supportAdminUid: adminUid, supportMerchantUid: merchantUid, supportStoreId: storeId, supportExpiresAt: Date.now() + 600000 }))

  console.log('impersonation security checks: PASS')
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })
