import { test, expect } from '@playwright/test'
import admin from 'firebase-admin'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { addDoc, collection, connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'

if (!admin.apps.length) admin.initializeApp({ projectId: 'mk-store-app' })
const adminDb = admin.firestore()

async function merchantClient(label: string) {
  const app = initializeApp({ apiKey: 'any', authDomain: 'mk-store-app.firebaseapp.com', projectId: 'mk-store-app' }, `${label}-${Date.now()}`)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  const functions = getFunctions(app)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  await signInWithEmailAndPassword(auth, 'owner@a.store', 'Owner12345')
  return { app, db, functions }
}

test('plan quota boundary: direct sales-link creation is denied', async () => {
  const client = await merchantClient('audit-sales-link')
  try {
    await expect(addDoc(collection(client.db, 'storeLinks'), {
      storeId: 'store-a',
      code: `bypass-${Date.now()}`,
      active: true,
      archived: false,
    })).rejects.toThrow()
  } finally {
    await deleteApp(client.app)
  }
})

test('notification boundary: browser cannot forge tenant notifications', async () => {
  const client = await merchantClient('audit-notification')
  try {
    await expect(addDoc(collection(client.db, 'notifications'), {
      storeId: 'store-a',
      userId: null,
      title: 'forged',
      body: 'forged',
      read: false,
    })).rejects.toThrow()
  } finally {
    await deleteApp(client.app)
  }
})

test('returned shipment restores inventory exactly once', async () => {
  const client = await merchantClient('audit-returned-shipment')
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const productId = `audit-product-${suffix}`
  const orderId = `audit-order-${suffix}`
  const shipmentId = `audit-shipment-${suffix}`
  const timestamp = admin.firestore.FieldValue.serverTimestamp()

  try {
    await adminDb.doc(`products/${productId}`).set({
      storeId: 'store-a', name: 'Audit product', price: 10, stock: 3,
      variants: [], active: true, createdAt: timestamp, updatedAt: timestamp,
    })
    await adminDb.doc(`orders/${orderId}`).set({
      storeId: 'store-a', orderNumber: `AUD-${suffix}`, status: 'SHIPPED',
      stockRestored: false, totalPrice: 20,
      items: [{ productId, name: 'Audit product', quantity: 2, price: 10 }],
      createdAt: timestamp, updatedAt: timestamp,
    })
    await adminDb.doc(`shipments/${shipmentId}`).set({
      id: shipmentId, storeId: 'store-a', orderId, providerId: 'manual',
      providerName: 'Manual', status: 'IN_TRANSIT', active: true,
      createdAt: timestamp, updatedAt: timestamp,
    })

    const update = httpsCallable<{ shipmentId: string; status: string }, { ok: boolean }>(client.functions, 'updateShipmentStatus')
    await update({ shipmentId, status: 'RETURNING' })
    await update({ shipmentId, status: 'RETURNED' })
    expect((await adminDb.doc(`products/${productId}`).get()).data()?.stock).toBe(5)
    expect((await adminDb.doc(`orders/${orderId}`).get()).data()).toMatchObject({ status: 'RETURNED', stockRestored: true })

    // A repeated terminal merchant transition is rejected, and must not
    // restore inventory a second time.
    await expect(update({ shipmentId, status: 'RETURNED' })).rejects.toThrow('هذا الانتقال غير متاح')
    expect((await adminDb.doc(`products/${productId}`).get()).data()?.stock).toBe(5)
  } finally {
    await Promise.all([
      adminDb.doc(`shipments/${shipmentId}`).delete().catch(() => {}),
      adminDb.doc(`orders/${orderId}`).delete().catch(() => {}),
      adminDb.doc(`products/${productId}`).delete().catch(() => {}),
    ])
    await deleteApp(client.app)
  }
})
