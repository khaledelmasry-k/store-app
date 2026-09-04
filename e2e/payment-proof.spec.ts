import { test, expect } from '@playwright/test'
import admin from 'firebase-admin'
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth'
import { connectStorageEmulator, getStorage, ref, uploadBytes, getBytes } from 'firebase/storage'

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199'

if (!admin.apps.length) admin.initializeApp({ projectId: 'mk-store-app', storageBucket: 'mk-store-app.firebasestorage.app' })
const db = admin.firestore()
const adminAuth = admin.auth()
const bucket = admin.storage().bucket('mk-store-app.firebasestorage.app')
const app = initializeApp({ apiKey: 'any', authDomain: 'mk-store-app.firebaseapp.com', projectId: 'mk-store-app', storageBucket: 'mk-store-app.firebasestorage.app' }, `payment-proof-${process.pid}`)
const auth = getAuth(app)
connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
const storage = getStorage(app)
connectStorageEmulator(storage, 'localhost', 9199)

async function signIn(uid: string) {
  await signInWithCustomToken(auth, await adminAuth.createCustomToken(uid))
}

test('payment proof path allows owned proofs and denies unsafe/cross-tenant access', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const ownerId = `proof-owner-${suffix}`
  const otherId = `proof-other-${suffix}`
  const storeId = `proof-store-${suffix}`
  const otherStoreId = `proof-other-store-${suffix}`
  await adminAuth.createUser({ uid: ownerId, email: `${ownerId}@mk.test`, password: 'Owner12345' })
  await adminAuth.createUser({ uid: otherId, email: `${otherId}@mk.test`, password: 'Owner12345' })
  await db.doc(`users/${ownerId}`).set({ uid: ownerId, role: 'merchant', active: true, storeIds: [storeId] })
  await db.doc(`users/${otherId}`).set({ uid: otherId, role: 'merchant', active: true, storeIds: [otherStoreId] })
  await db.doc(`stores/${storeId}`).set({ ownerId, storeStatus: 'draft', storageUsed: 0, storageLimitBytes: 10 * 1024 * 1024 })
  await db.doc(`stores/${otherStoreId}`).set({ ownerId: otherId, storeStatus: 'draft', storageUsed: 0, storageLimitBytes: 10 * 1024 * 1024 })

  await signIn(ownerId)
  const base = `documents/${storeId}/payment-proofs`
  await uploadBytes(ref(storage, `${base}/proof.jpg`), new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg', customMetadata: { storeId } })
  await uploadBytes(ref(storage, `${base}/proof.pdf`), new Uint8Array([4, 5, 6]), { contentType: 'application/pdf', customMetadata: { storeId } })
  await expect(uploadBytes(ref(storage, `${base}/proof.exe`), new Uint8Array([7]), { contentType: 'application/x-msdownload', customMetadata: { storeId } })).rejects.toThrow()
  await expect(uploadBytes(ref(storage, `${base}/proof-too-large.jpg`), new Uint8Array(5 * 1024 * 1024 + 1), { contentType: 'image/jpeg', customMetadata: { storeId } })).rejects.toThrow()
  await expect(uploadBytes(ref(storage, `${base}/proof-cross.jpg`), new Uint8Array([8]), { contentType: 'image/jpeg', customMetadata: { storeId: otherStoreId } })).rejects.toThrow()

  await signIn(otherId)
  await expect(uploadBytes(ref(storage, `${base}/other.jpg`), new Uint8Array([9]), { contentType: 'image/jpeg', customMetadata: { storeId } })).rejects.toThrow()
  await expect(getBytes(ref(storage, `${base}/proof.jpg`))).rejects.toThrow()

  await signIn('seed-admin')
  await expect(getBytes(ref(storage, `${base}/proof.jpg`))).resolves.toBeTruthy()

  await bucket.deleteFiles({ prefix: `${base}/` })
  await db.doc(`users/${ownerId}`).delete()
  await db.doc(`users/${otherId}`).delete()
  await db.doc(`stores/${storeId}`).delete()
  await db.doc(`stores/${otherStoreId}`).delete()
  await adminAuth.deleteUser(ownerId)
  await adminAuth.deleteUser(otherId)
})
