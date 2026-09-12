// Emulator-only Firestore/Storage boundary checks. No production hosts are
// accepted and all fixtures use security-test identifiers.
import admin from 'firebase-admin'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInWithCustomToken, signOut } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore'
import { getStorage, connectStorageEmulator, ref, uploadBytes } from 'firebase/storage'

if (!/^(localhost|127\.0\.0\.1):/.test(process.env.FIRESTORE_EMULATOR_HOST || '') || !/^(localhost|127\.0\.0\.1):/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST || '')) throw new Error('Refusing to run outside emulators')
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'mk-store-app' })
const adb = admin.firestore(); const aauth = admin.auth()
const app = initializeApp({ apiKey: 'AIzaSyASSp0drLChc2gRDBUk32DGMndHYRezET0', projectId: 'mk-store-app', storageBucket: 'mk-store-app.firebasestorage.app' }, `rules-${Date.now()}`)
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080)
const storage = getStorage(app); connectStorageEmulator(storage, '127.0.0.1', 9199)
const adminUid = 'rules-admin'; const merchantUid = 'rules-merchant'; const storeId = 'rules-store'

async function expectDenied(action, label) {
  try { await action(); throw new Error(`${label} unexpectedly allowed`) } catch (error) { if (String(error.message || '').includes('unexpectedly allowed')) throw error }
}
async function main() {
  await aauth.createUser({ uid: adminUid, email: 'rules-admin@mk.test', password: 'Security-only-123!', emailVerified: true }).catch(() => {})
  await aauth.createUser({ uid: merchantUid, email: 'rules-merchant@mk.test', password: 'Security-only-123!', emailVerified: true }).catch(() => {})
  await adb.doc(`users/${adminUid}`).set({ uid: adminUid, role: 'superAdmin', active: true, storeIds: [] })
  await adb.doc(`users/${merchantUid}`).set({ uid: merchantUid, role: 'merchant', active: true, storeIds: [storeId] })
  await adb.doc(`stores/${storeId}`).set({ ownerId: merchantUid, active: true, published: false })

  const merchantCustom = await aauth.createCustomToken(merchantUid); await signOut(auth); await signInWithCustomToken(auth, merchantCustom)
  if (!(await getDoc(doc(db, 'stores', storeId))).exists()) throw new Error('normal merchant own read failed')
  await expectDenied(() => getDoc(doc(db, 'stores', 'other-store')), 'normal merchant other store')

  const sessionId = 'rules-session'
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 600000)
  await adb.doc(`supportImpersonationSessions/${sessionId}`).set({ sessionId, adminUid, merchantUid, storeId, status: 'active', expiresAt })
  const supportCustom = await aauth.createCustomToken(merchantUid, { supportImpersonation: true, supportSessionId: sessionId, supportAdminUid: adminUid, supportMerchantUid: merchantUid, supportStoreId: storeId, supportExpiresAt: Date.now() + 600000 })
  await signOut(auth); await signInWithCustomToken(auth, supportCustom)
  if (!(await getDoc(doc(db, 'stores', storeId))).exists()) throw new Error('valid support read failed')
  await expectDenied(() => getDoc(doc(db, 'stores', 'other-store')), 'wrong-store support read')
  await expectDenied(() => getDoc(doc(db, 'supportImpersonationSessions', sessionId)), 'support collection read')
  await adb.doc(`supportImpersonationSessions/${sessionId}`).update({ status: 'ended' })
  await expectDenied(() => getDoc(doc(db, 'stores', storeId)), 'ended support read')

  // Storage public reads remain public; private writes are session-bound.
  const image = ref(storage, `stores/${storeId}/private-test.txt`)
  await expectDenied(() => uploadBytes(image, new Uint8Array([1]), { contentType: 'image/png', customMetadata: { storeId } }), 'ended support storage write')

  // Expiry, wrong-store and removed-admin checks use fresh active sessions.
  const expiredId = 'rules-expired'
  await adb.doc(`supportImpersonationSessions/${expiredId}`).set({ sessionId: expiredId, adminUid, merchantUid, storeId, status: 'active', expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1000) })
  const expiredCustom = await aauth.createCustomToken(merchantUid, { supportImpersonation: true, supportSessionId: expiredId, supportAdminUid: adminUid, supportMerchantUid: merchantUid, supportStoreId: storeId, supportExpiresAt: Date.now() - 1000 })
  await signOut(auth); await signInWithCustomToken(auth, expiredCustom)
  await expectDenied(() => getDoc(doc(db, 'stores', storeId)), 'expired support read')
  await expectDenied(() => uploadBytes(ref(storage, `stores/${storeId}/expired.txt`), new Uint8Array([1]), { contentType: 'image/png', customMetadata: { storeId } }), 'expired support storage write')

  const wrongStoreId = 'rules-wrong-store'
  await adb.doc(`supportImpersonationSessions/${wrongStoreId}`).set({ sessionId: wrongStoreId, adminUid, merchantUid, storeId, status: 'active', expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 600000) })
  const wrongCustom = await aauth.createCustomToken(merchantUid, { supportImpersonation: true, supportSessionId: wrongStoreId, supportAdminUid: adminUid, supportMerchantUid: merchantUid, supportStoreId: 'other-store', supportExpiresAt: Date.now() + 600000 })
  await signOut(auth); await signInWithCustomToken(auth, wrongCustom)
  await expectDenied(() => getDoc(doc(db, 'stores', storeId)), 'wrong-store support claim')
  await expectDenied(() => uploadBytes(ref(storage, `stores/${storeId}/wrong-store.txt`), new Uint8Array([1]), { contentType: 'image/png', customMetadata: { storeId } }), 'wrong-store support storage write')

  const roleRemovedId = 'rules-role-removed'
  await adb.doc(`supportImpersonationSessions/${roleRemovedId}`).set({ sessionId: roleRemovedId, adminUid, merchantUid, storeId, status: 'active', expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 600000) })
  const roleRemovedCustom = await aauth.createCustomToken(merchantUid, { supportImpersonation: true, supportSessionId: roleRemovedId, supportAdminUid: adminUid, supportMerchantUid: merchantUid, supportStoreId: storeId, supportExpiresAt: Date.now() + 600000 })
  await adb.doc(`users/${adminUid}`).update({ role: 'merchant' })
  await signOut(auth); await signInWithCustomToken(auth, roleRemovedCustom)
  await expectDenied(() => getDoc(doc(db, 'stores', storeId)), 'removed-admin support read')
  await expectDenied(() => uploadBytes(ref(storage, `stores/${storeId}/removed-admin.txt`), new Uint8Array([1]), { contentType: 'image/png', customMetadata: { storeId } }), 'removed-admin support storage write')
  await deleteApp(app)
  console.log('Firestore rules tests: PASS')
  console.log('Storage rules tests: PASS')
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
