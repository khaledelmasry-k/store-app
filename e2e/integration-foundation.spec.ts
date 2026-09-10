import { createServer, type Server } from 'node:http'
import { test, expect } from '@playwright/test'
import admin from 'firebase-admin'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
if (!admin.apps.length) admin.initializeApp({ projectId: 'mk-store-app' })
const db = admin.firestore()
const adminAuth = admin.auth()
const carrierCalls: Array<{ method: string; url: string; body: any; authorization?: string }> = []
let carrier: Server

async function callAs(uid: string, name: string, data: Record<string, unknown> = {}) {
  const app = initializeApp({ apiKey: 'any', authDomain: 'mk-store-app.firebaseapp.com', projectId: 'mk-store-app' }, `integration-${uid}-${Date.now()}-${Math.random()}`)
  try {
    const auth = getAuth(app)
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    await signInWithCustomToken(auth, await adminAuth.createCustomToken(uid))
    const functions = getFunctions(app)
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
    return await httpsCallable(functions, name)(data)
  } finally { await deleteApp(app) }
}

async function eventually<T>(read: () => Promise<T>, predicate: (value: T) => boolean, timeout = 20_000) {
  const started = Date.now()
  let value = await read()
  while (!predicate(value) && Date.now() - started < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    value = await read()
  }
  expect(predicate(value)).toBe(true)
  return value
}

async function orderFixture(id: string, status = 'NEW') {
  const productId = `product-${id}`
  await db.doc(`products/${productId}`).set({ storeId: 'store-a', name: 'Integration product', active: true, price: 100, stock: 3, variants: [], createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() })
  await db.doc(`orders/${id}`).set({
    id, storeId: 'store-a', orderNumber: `INT-${id}`, customerName: 'عميل اختبار', phone: '01000000000', secondaryPhone: '01100000000',
    governorate: 'القاهرة', city: 'مدينة نصر', area: 'الحي السابع', address: '١ شارع الاختبار', notes: 'اتصل قبل الوصول',
    items: [{ productId, name: 'Integration product', quantity: 2, price: 100 }], subtotal: 200, shippingFee: 40, totalPrice: 240,
    paymentMethod: 'cod', status, statusHistory: [{ status, at: admin.firestore.Timestamp.now() }], inventoryDeducted: true, stockRestored: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  return { orderId: id, productId }
}

async function saveCredentials(apiKey = 'good-api-key', webhookSecret = 'webhook-secret') {
  return callAs('seed-owner-a', 'saveIntegrationCredentials', { storeId: 'store-a', providerId: 'provider-bosta', credentials: { apiKey, webhookSecret } })
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  carrier = createServer(async (request, response) => {
    let raw = ''
    for await (const chunk of request) raw += chunk
    const body = raw ? JSON.parse(raw) : null
    const authorization = String(request.headers.authorization || '')
    carrierCalls.push({ method: request.method || 'GET', url: request.url || '/', body, authorization })
    response.setHeader('content-type', 'application/json')
    if (authorization !== 'good-api-key') { response.statusCode = 401; response.end(JSON.stringify({ message: 'invalid api key' })); return }
    if (request.method === 'POST' && request.url?.startsWith('/api/v2/deliveries/mass-awb')) {
      response.end(JSON.stringify({ data: Buffer.from('%PDF-1.4\n%%EOF').toString('base64') }))
      return
    }
    if (request.method === 'POST' && request.url?.startsWith('/api/v2/deliveries')) {
      const reference = String(body?.businessReference || 'unknown')
      response.end(JSON.stringify({ data: { _id: `ext-${reference}`, trackingNumber: `TRK-${reference}`, state: 10, shippingCost: 38 } }))
      return
    }
    if (request.method === 'GET' && request.url?.includes('/businesses/deliveries/')) {
      const tracking = decodeURIComponent(request.url.split('/').pop() || '')
      response.end(JSON.stringify({ data: { _id: tracking.replace('TRK-', 'ext-'), trackingNumber: tracking, state: tracking.includes('cancel-') ? 10 : 30 } }))
      return
    }
    if (request.method === 'DELETE') {
      if (request.url?.includes('reject-cancel')) { response.statusCode = 409; response.end(JSON.stringify({ message: 'carrier rejected cancellation' })); return }
      response.end(JSON.stringify({ success: true })); return
    }
    response.end(JSON.stringify({ data: { deliveries: [] } }))
  })
  await new Promise<void>((resolve) => carrier.listen(4789, '127.0.0.1', resolve))
  await db.doc('shippingProviders/provider-bosta').set({
    id: 'provider-bosta', name: 'Bosta', slug: 'bosta', status: 'active', integrationType: 'api', credentialMode: 'merchant',
    apiBaseUrl: 'http://127.0.0.1:4789/api/v2', supportsCOD: true, supportsTracking: true, supportsWebhooks: true, services: [],
  })
  await callAs('seed-owner-a', 'saveStoreShippingProvider', { storeId: 'store-a', providerId: 'provider-bosta', config: { enabled: true, isDefault: true, codEnabled: true, defaultPackageWeight: 1 } })
})

test.afterAll(async () => { await new Promise<void>((resolve) => carrier.close(() => resolve())) })

test('credential vault encrypts, redacts, validates, and blocks cross-tenant access', async () => {
  const saved = await saveCredentials()
  expect((saved.data as any).maskedCredentials.apiKey).toBe('************-key')
  const vault = (await db.doc('integrationCredentials/store-a_shipping_bosta').get()).data()!
  expect(vault.envelope.algorithm).toBe('aes-256-gcm')
  expect(JSON.stringify(vault)).not.toContain('good-api-key')
  const tested = await callAs('seed-owner-a', 'testShippingConnection', { storeId: 'store-a', providerId: 'provider-bosta' })
  expect(tested.data).toMatchObject({ ok: true, status: 'CONNECTED' })
  await expect(callAs('seed-owner-b', 'saveIntegrationCredentials', { storeId: 'store-a', providerId: 'provider-bosta', credentials: { apiKey: 'stolen' } })).rejects.toThrow()
  const client = initializeApp({ apiKey: 'any', authDomain: 'mk-store-app.firebaseapp.com', projectId: 'mk-store-app' }, `rules-${Date.now()}`)
  try {
    const auth = getAuth(client); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); await signInWithCustomToken(auth, await adminAuth.createCustomToken('seed-owner-a'))
    const firestore = getFirestore(client); connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
    await expect(getDoc(doc(firestore, 'integrationCredentials', 'store-a_shipping_bosta'))).rejects.toThrow()
  } finally { await deleteApp(client) }
})

test('MANUAL + first PROCESSING transition does not create a shipment', async () => {
  await callAs('seed-owner-a', 'saveShippingAutomationSettings', { storeId: 'store-a', automaticShipmentCreation: 'MANUAL' })
  const { orderId } = await orderFixture(`manual-${Date.now()}`, 'CONTACTED')
  await callAs('seed-owner-a', 'updateOrderStatus', { orderId, status: 'PROCESSING' })
  const eventId = `order-${orderId}-PROCESSING`
  const event = await eventually(async () => (await db.doc(`integrationEvents/${eventId}`).get()).data(), (value: any) => value?.processingStatus === 'PROCESSED')
  expect((event as any).outcome).toBe('MANUAL_MODE')
  expect((await db.doc(`orders/${orderId}`).get()).data()?.activeShipmentId).toBeUndefined()
})

test('after-confirmation creates one real carrier shipment and duplicate events are idempotent', async () => {
  await saveCredentials()
  await callAs('seed-owner-a', 'saveShippingAutomationSettings', { storeId: 'store-a', automaticShipmentCreation: 'AFTER_CONFIRMATION' })
  const { orderId } = await orderFixture(`confirmed-${Date.now()}`, 'CONTACTED')
  await callAs('seed-owner-a', 'updateOrderStatus', { orderId, status: 'PROCESSING' })
  const order = await eventually(async () => (await db.doc(`orders/${orderId}`).get()).data(), (value: any) => Boolean(value?.activeShipmentId))
  const shipment = (await db.doc(`shipments/${(order as any).activeShipmentId}`).get()).data()!
  expect(shipment.externalShipmentId).toBe(`ext-INT-${orderId}`)
  expect(shipment.trackingNumber).toBe(`TRK-INT-${orderId}`)
  const duplicateEvent = `duplicate-${Date.now()}`
  await db.doc(`integrationEvents/${duplicateEvent}`).set({ eventId: duplicateEvent, storeId: 'store-a', eventType: 'order.confirmed', entityType: 'order', entityId: orderId, payload: { orderId }, processingStatus: 'PENDING', attempts: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() })
  await eventually(async () => (await db.doc(`integrationEvents/${duplicateEvent}`).get()).data(), (value: any) => value?.processingStatus === 'PROCESSED')
  expect(carrierCalls.filter((call) => call.method === 'POST' && call.body?.businessReference === `INT-${orderId}`)).toHaveLength(1)
})

test('immediately-after-checkout mode creates from order.created, while missing default and disabled provider fail safely', async () => {
  await saveCredentials()
  await callAs('seed-owner-a', 'saveShippingAutomationSettings', { storeId: 'store-a', automaticShipmentCreation: 'IMMEDIATELY_AFTER_CHECKOUT' })
  const immediate = await orderFixture(`immediate-${Date.now()}`)
  const eventId = `immediate-event-${Date.now()}`
  await db.doc(`integrationEvents/${eventId}`).set({ eventId, storeId: 'store-a', eventType: 'order.created', entityType: 'order', entityId: immediate.orderId, payload: { orderId: immediate.orderId }, processingStatus: 'PENDING', attempts: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() })
  await eventually(async () => (await db.doc(`orders/${immediate.orderId}`).get()).data(), (value: any) => Boolean(value?.activeShipmentId))
  const retryEventId = `immediate-retry-${Date.now()}`
  await db.doc(`integrationEvents/${retryEventId}`).set({ eventId: retryEventId, storeId: 'store-a', eventType: 'order.created', entityType: 'order', entityId: immediate.orderId, payload: { orderId: immediate.orderId }, processingStatus: 'PENDING', attempts: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() })
  await eventually(async () => (await db.doc(`integrationEvents/${retryEventId}`).get()).data(), (value: any) => value?.processingStatus === 'PROCESSED')
  expect(carrierCalls.filter((call) => call.method === 'POST' && call.body?.businessReference === `INT-${immediate.orderId}`)).toHaveLength(1)

  await callAs('seed-owner-a', 'saveStoreShippingProvider', { storeId: 'store-a', providerId: 'provider-bosta', config: { enabled: true, isDefault: false } })
  const noDefault = await orderFixture(`no-default-${Date.now()}`)
  await expect(callAs('seed-owner-a', 'createOrderShipment', { orderId: noDefault.orderId })).rejects.toThrow()
  expect((await db.doc(`orders/${noDefault.orderId}`).get()).data()).toMatchObject({ status: 'NEW', shippingCreationStatus: 'FAILED', shippingCreationErrorCode: 'CONFIGURATION_ERROR' })

  await callAs('seed-owner-a', 'saveStoreShippingProvider', { storeId: 'store-a', providerId: 'provider-bosta', config: { enabled: false, isDefault: true } })
  const disabled = await orderFixture(`disabled-${Date.now()}`)
  await expect(callAs('seed-owner-a', 'createOrderShipment', { orderId: disabled.orderId, providerId: 'provider-bosta' })).rejects.toThrow()
  expect((await db.doc(`orders/${disabled.orderId}`).get()).data()?.status).toBe('NEW')
  await callAs('seed-owner-a', 'saveStoreShippingProvider', { storeId: 'store-a', providerId: 'provider-bosta', config: { enabled: true, isDefault: true, codEnabled: true } })
})

test('invalid credentials preserve the order, expose failure, and retry succeeds', async () => {
  await saveCredentials('bad-api-key')
  const { orderId } = await orderFixture(`retry-${Date.now()}`)
  await expect(callAs('seed-owner-a', 'createOrderShipment', { orderId, providerId: 'provider-bosta' })).rejects.toThrow()
  expect((await db.doc(`orders/${orderId}`).get()).data()).toMatchObject({ status: 'NEW', shippingCreationStatus: 'FAILED', shippingCreationErrorCode: 'INVALID_CREDENTIALS' })
  await saveCredentials()
  const retried = await callAs('seed-owner-a', 'createOrderShipment', { orderId, providerId: 'provider-bosta', retry: true })
  expect((retried.data as any).shipment.trackingNumber).toBe(`TRK-INT-${orderId}`)
})

test('tracking, cancel, webhook authorization, duplicate delivery, and returned inventory are safe', async () => {
  await saveCredentials()
  const first = await orderFixture(`tracking-${Date.now()}`)
  const created = await callAs('seed-owner-a', 'createOrderShipment', { orderId: first.orderId, providerId: 'provider-bosta' })
  const shipmentId = (created.data as any).shipment.id
  const tracked = await callAs('seed-owner-a', 'refreshShipmentTracking', { shipmentId })
  expect((tracked.data as any).status).toBe('IN_TRANSIT')
  const document = await callAs('seed-owner-a', 'downloadShipmentDocument', { shipmentId })
  expect(Buffer.from((document.data as any).contentBase64, 'base64').toString('utf8')).toContain('%PDF')
  await expect(callAs('seed-owner-b', 'downloadShipmentDocument', { shipmentId })).rejects.toThrow()
  await expect(callAs('seed-owner-b', 'refreshShipmentTracking', { shipmentId })).rejects.toThrow()

  const cancellable = await orderFixture(`cancel-${Date.now()}`)
  const cancellation = await callAs('seed-owner-a', 'createOrderShipment', { orderId: cancellable.orderId, providerId: 'provider-bosta' })
  await callAs('seed-owner-a', 'cancelExternalShipment', { shipmentId: (cancellation.data as any).shipment.id })
  expect((await db.doc(`shipments/${(cancellation.data as any).shipment.id}`).get()).data()?.status).toBe('CANCELLED')
  expect((await db.doc(`orders/${cancellable.orderId}`).get()).data()).toMatchObject({ status: 'CANCELLED', stockRestored: true, inventoryRestoredQuantity: 2 })
  expect((await db.doc(`products/${cancellable.productId}`).get()).data()?.stock).toBe(5)
  await callAs('seed-owner-a', 'cancelExternalShipment', { shipmentId: (cancellation.data as any).shipment.id })
  expect((await db.doc(`products/${cancellable.productId}`).get()).data()?.stock).toBe(5)
  expect((await db.doc(`orders/${cancellable.orderId}`).get()).data()?.status).toBe('CANCELLED')
  expect(carrierCalls.filter((call) => call.method === 'DELETE' && call.url.includes(`TRK-INT-${cancellable.orderId}`))).toHaveLength(1)

  const returned = await orderFixture(`returned-${Date.now()}`, 'SHIPPED')
  const returnedCreation = await callAs('seed-owner-a', 'createOrderShipment', { orderId: returned.orderId, providerId: 'provider-bosta' })
  const returnedShipment = (returnedCreation.data as any).shipment
  const url = 'http://127.0.0.1:5001/mk-store-app/us-central1/shippingWebhook/bosta'
  const payload = { _id: returnedShipment.externalShipmentId, trackingNumber: returnedShipment.trackingNumber, state: 60, timeStamp: 123456789 }
  expect((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'wrong' }, body: JSON.stringify(payload) })).status).toBe(401)
  const accepted = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'webhook-secret' }, body: JSON.stringify(payload) })
  expect(accepted.status).toBe(200)
  expect((await db.doc(`products/${returned.productId}`).get()).data()?.stock).toBe(3)
  expect((await db.doc(`orders/${returned.orderId}`).get()).data()?.stockRestored).toBe(false)
  const duplicate = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'webhook-secret' }, body: JSON.stringify(payload) })
  expect(duplicate.status).toBe(200)
  expect((await db.doc(`products/${returned.productId}`).get()).data()?.stock).toBe(3)
  const unknown = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'webhook-secret' }, body: JSON.stringify({ ...payload, _id: 'unknown', trackingNumber: 'unknown' }) })
  expect(unknown.status).toBe(404)

  const delivered = await orderFixture(`delivered-${Date.now()}`, 'SHIPPED')
  const deliveredCreation = await callAs('seed-owner-a', 'createOrderShipment', { orderId: delivered.orderId, providerId: 'provider-bosta' })
  const deliveredShipment = (deliveredCreation.data as any).shipment
  const deliveredResponse = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'webhook-secret' }, body: JSON.stringify({ _id: deliveredShipment.externalShipmentId, trackingNumber: deliveredShipment.trackingNumber, state: 45, timeStamp: 223456789 }) })
  expect(deliveredResponse.status).toBe(200)
  expect((await db.doc(`orders/${delivered.orderId}`).get()).data()?.status).toBe('DELIVERED')
})

test('provider cancellation rejection leaves order and inventory untouched', async () => {
  await saveCredentials()
  const rejected = await orderFixture(`reject-cancel-${Date.now()}`)
  const created = await callAs('seed-owner-a', 'createOrderShipment', { orderId: rejected.orderId, providerId: 'provider-bosta' })
  await expect(callAs('seed-owner-a', 'cancelExternalShipment', { shipmentId: (created.data as any).shipment.id })).rejects.toThrow()
  expect((await db.doc(`orders/${rejected.orderId}`).get()).data()?.status).not.toBe('CANCELLED')
  expect((await db.doc(`orders/${rejected.orderId}`).get()).data()?.stockRestored).toBe(false)
  expect((await db.doc(`products/${rejected.productId}`).get()).data()?.stock).toBe(3)
})

test('duplicate provider CANCELLED webhook restores inventory once', async () => {
  await saveCredentials()
  const cancelled = await orderFixture(`provider-cancel-${Date.now()}`)
  const created = await callAs('seed-owner-a', 'createOrderShipment', { orderId: cancelled.orderId, providerId: 'provider-bosta' })
  const shipment = (created.data as any).shipment
  const url = 'http://127.0.0.1:5001/mk-store-app/us-central1/shippingWebhook/bosta'
  const payload = { _id: shipment.externalShipmentId, trackingNumber: shipment.trackingNumber, state: 48, timeStamp: 323456789 }
  const first = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'webhook-secret' }, body: JSON.stringify(payload) })
  const second = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'webhook-secret' }, body: JSON.stringify(payload) })
  expect(first.status).toBe(200)
  expect(second.status).toBe(200)
  expect((await db.doc(`orders/${cancelled.orderId}`).get()).data()).toMatchObject({ status: 'CANCELLED', stockRestored: true, inventoryRestoredQuantity: 2 })
  expect((await db.doc(`products/${cancelled.productId}`).get()).data()?.stock).toBe(5)
})

test('local cancellation restores exact variants and plain stock once', async () => {
  const suffix = Date.now()
  const productA = `variant-a-${suffix}`
  const productB = `plain-b-${suffix}`
  const orderId = `variant-cancel-${suffix}`
  await db.doc(`products/${productA}`).set({
    storeId: 'store-a', name: 'A', active: true, stock: 16,
    variants: [{ id: 'm-black', color: 'Black', size: 'M', stock: 3 }, { id: 'l-black', color: 'Black', size: 'L', stock: 4 }, { id: 'xl-black', color: 'Black', size: 'XL', stock: 9 }],
  })
  await db.doc(`products/${productB}`).set({ storeId: 'store-a', name: 'B', active: true, stock: 7, variants: [] })
  await db.doc(`orders/${orderId}`).set({
    storeId: 'store-a', orderNumber: `VAR-${suffix}`, status: 'NEW', inventoryDeducted: true, stockRestored: false, totalPrice: 60,
    items: [
      { id: 'a-m', productId: productA, variantId: 'm-black', color: 'Black', size: 'M', quantity: 2, name: 'A M', price: 10 },
      { id: 'a-l', productId: productA, variantId: 'l-black', color: 'Black', size: 'L', quantity: 1, name: 'A L', price: 10 },
      { id: 'b', productId: productB, quantity: 3, name: 'B', price: 10 },
    ],
  })
  // Product names and option labels may change after checkout. The persisted
  // productId/variantId snapshot must remain authoritative for restoration.
  await db.doc(`products/${productA}`).update({
    name: 'A renamed after checkout',
    variants: [{ id: 'm-black', color: 'Midnight', size: 'Medium', stock: 3 }, { id: 'l-black', color: 'Midnight', size: 'Large', stock: 4 }, { id: 'xl-black', color: 'Midnight', size: 'XL', stock: 9 }],
  })
  await db.doc(`products/${productB}`).update({ name: 'B renamed after checkout' })
  await callAs('seed-owner-a', 'updateOrderStatus', { orderId, status: 'CANCELLED' })
  await callAs('seed-owner-a', 'updateOrderStatus', { orderId, status: 'CANCELLED' })
  const a = (await db.doc(`products/${productA}`).get()).data()!
  const b = (await db.doc(`products/${productB}`).get()).data()!
  expect(a.variants).toMatchObject([{ id: 'm-black', stock: 5 }, { id: 'l-black', stock: 5 }, { id: 'xl-black', stock: 9 }])
  expect(a.stock).toBe(19)
  expect(b.stock).toBe(10)
  expect((await db.doc(`orders/${orderId}`).get()).data()).toMatchObject({ stockRestored: true, inventoryRestoredQuantity: 6 })
})

test('Wasla adapter exposes no automatic cancellation capability', async () => {
  const providers = await callAs('seed-owner-a', 'getMerchantShippingProviders', { storeId: 'store-a' })
  const wasla = ((providers.data as any).adapters || []).find((adapter: any) => adapter.slug === 'wasla')
  expect(wasla.capabilities).toContain('createShipment')
  expect(wasla.capabilities).toContain('tracking')
  expect(wasla.capabilities).not.toContain('cancel')
})
