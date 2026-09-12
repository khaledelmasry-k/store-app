import type { Firestore } from 'firebase-admin/firestore'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getShippingAdapter } from './registry'
import { decryptCredentials, sanitizeSensitiveText, type CredentialEnvelope } from '../integrations/vault'
import { emitIntegrationEvent } from '../integrations/outbox'
import { ShippingProviderError } from './bosta'
import { waslaPublicTrackingCode } from './wasla'

export type ShipmentCreationTrigger = 'MANUAL' | 'AFTER_CONFIRMATION' | 'IMMEDIATELY_AFTER_CHECKOUT' | 'RETRY'

export function credentialDocumentId(storeId: string, integrationType: string, provider: string) {
  return `${storeId}_${integrationType}_${provider}`.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export async function loadIntegrationCredentials(db: Firestore, storeId: string, integrationType: string, provider: string) {
  const ref = db.doc(`integrationCredentials/${credentialDocumentId(storeId, integrationType, provider)}`)
  const snap = await ref.get()
  if (!snap.exists || snap.data()?.status === 'DISABLED') return null
  const data = snap.data() || {}
  const credentials = decryptCredentials(data.envelope as CredentialEnvelope, { storeId, integrationType, provider })
  return { ref, data, credentials }
}

export function publicWebhookUrl(provider: string) {
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'mk-store-app'
  const configured = String(process.env.PUBLIC_FUNCTIONS_BASE_URL || '').trim()
  const emulator = process.env.FUNCTIONS_EMULATOR === 'true'
  const base = (configured || (emulator
    ? `http://127.0.0.1:5001/${project}/us-central1`
    : `https://us-central1-${project}.cloudfunctions.net`)).replace(/\/$/, '')
  if (!emulator && (!/^https:\/\//i.test(base) || /(^|\/)localhost(?::|\/|$)|127\.0\.0\.1/i.test(base))) {
    throw new Error('PUBLIC_FUNCTIONS_BASE_URL must be a production HTTPS URL')
  }
  return `${base}/shippingWebhook/${encodeURIComponent(provider)}`
}

function errorDetails(error: unknown) {
  if (error instanceof ShippingProviderError) return { code: error.code, message: sanitizeSensitiveText(error.message), retryable: error.retryable }
  return { code: 'SHIPMENT_CREATION_FAILED', message: sanitizeSensitiveText(error instanceof Error ? error.message : 'Shipment creation failed'), retryable: true }
}

export async function createShipmentForOrder(
  db: Firestore,
  input: { orderId: string; providerId?: string | null; trigger: ShipmentCreationTrigger; actorId: string },
) {
  const orderRef = db.doc(`orders/${input.orderId}`)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Order not found', false)
  const order = orderSnap.data() || {}
  const storeId = String(order.storeId || '')
  if (!storeId) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Order store is missing', false)
  if (['CANCELLED', 'RETURNED'].includes(String(order.status || ''))) {
    throw new ShippingProviderError('CONFIGURATION_ERROR', 'Cannot create a shipment for a terminal order', false)
  }
  if (!String(order.customerName || '').trim() || !String(order.phone || '').trim() || !String(order.address || '').trim()) {
    throw new ShippingProviderError('CONFIGURATION_ERROR', 'Order customer name, phone, and address are required', false)
  }
  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new ShippingProviderError('CONFIGURATION_ERROR', 'Order items are required', false)
  }
  if (order.paymentMethod === 'cod' && (!Number.isFinite(Number(order.totalPrice)) || Number(order.totalPrice) < 0)) {
    throw new ShippingProviderError('CONFIGURATION_ERROR', 'A valid COD amount is required', false)
  }

  let providerId = String(input.providerId || order.shippingProviderId || '').trim()
  if (!providerId) {
    const defaults = await db.collection('storeShippingProviders')
      .where('storeId', '==', storeId).where('enabled', '==', true).where('isDefault', '==', true).limit(2).get()
    if (defaults.size !== 1) {
      await orderRef.set({
        shippingCreationStatus: 'FAILED',
        shippingCreationErrorCode: 'CONFIGURATION_ERROR',
        shippingCreationErrorMessage: 'No single default shipping provider is configured',
        shippingLastAttemptAt: FieldValue.serverTimestamp(),
        shippingRetryCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      throw new ShippingProviderError('CONFIGURATION_ERROR', 'No single default shipping provider is configured', false)
    }
    providerId = defaults.docs[0].data().providerId
  }

  const guardId = `${storeId}_${input.orderId}_${providerId}`.replace(/[^a-zA-Z0-9_-]/g, '_')
  const guardRef = db.doc(`shipmentCreationGuards/${guardId}`)
  const shipmentRef = db.doc(`shipments/${guardId}`)
  const claimed = await db.runTransaction(async (tx) => {
    const [freshOrder, guardSnap, existingShipment] = await Promise.all([
      tx.get(orderRef), tx.get(guardRef), tx.get(shipmentRef),
    ])
    if (!freshOrder.exists) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Order not found', false)
    if (freshOrder.data()?.activeShipmentId) return { existingShipmentId: String(freshOrder.data()?.activeShipmentId) }
    if (existingShipment.exists) return { existingShipmentId: shipmentRef.id }
    const guard = guardSnap.data() || {}
    const claimedAtMs = guard.lastAttemptAt?.toMillis?.() || 0
    if (guard.processingStatus === 'PROCESSING' && Date.now() - claimedAtMs < 2 * 60_000) {
      throw new ShippingProviderError('PROVIDER_UNAVAILABLE', 'Shipment creation is already in progress', true)
    }
    tx.set(guardRef, {
      id: guardId,
      storeId,
      orderId: input.orderId,
      providerId,
      idempotencyKey: guardId,
      processingStatus: 'PROCESSING',
      attempts: FieldValue.increment(1),
      lastAttemptAt: FieldValue.serverTimestamp(),
      createdAt: guardSnap.exists ? guard.createdAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      actorId: input.actorId,
      trigger: input.trigger,
    }, { merge: true })
    tx.update(orderRef, {
      shippingCreationStatus: 'PROCESSING',
      shippingCreationErrorCode: null,
      shippingCreationErrorMessage: null,
      shippingLastAttemptAt: FieldValue.serverTimestamp(),
      shippingRetryCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    })
    return { existingShipmentId: null }
  })
  if (claimed.existingShipmentId) {
    const existing = await db.doc(`shipments/${claimed.existingShipmentId}`).get()
    return { shipment: existing.exists ? { id: existing.id, ...existing.data() } : null, duplicate: true }
  }

  try {
    const [providerSnap, configSnap] = await Promise.all([
      db.doc(`shippingProviders/${providerId}`).get(),
      db.doc(`storeShippingProviders/${storeId}_${providerId}`).get(),
    ])
    if (!providerSnap.exists || providerSnap.data()?.status !== 'active') throw new ShippingProviderError('CONFIGURATION_ERROR', 'Shipping provider is disabled', false)
    if (!configSnap.exists || configSnap.data()?.enabled !== true) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Shipping provider is disabled for this store', false)
    const provider: Record<string, any> = { id: providerSnap.id, ...(providerSnap.data() || {}) }
    const config = configSnap.data() || {}
    const adapter = getShippingAdapter(String(provider.slug || ''), provider.integrationType)
    const createShipment = adapter?.createShipment
    if (!adapter || !createShipment || !adapter.capabilities.includes('createShipment')) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Shipping provider cannot create shipments', false)
    if (!['MANUAL', 'RETRY'].includes(input.trigger) && provider.integrationType !== 'api') {
      throw new ShippingProviderError('CONFIGURATION_ERROR', 'Automatic shipment creation requires an API provider', false)
    }
    const vault = provider.integrationType === 'manual'
      ? null
      : await loadIntegrationCredentials(db, storeId, 'shipping', String(provider.slug || ''))
    if (provider.integrationType !== 'manual' && !vault) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Shipping credentials are not configured', false)
    const result = await createShipment(
      { provider, config, credentials: vault?.credentials || null },
      { orderId: input.orderId, order, idempotencyKey: guardId, webhookUrl: publicWebhookUrl(String(provider.slug || '')) },
    )
    const status = adapter.mapStatus ? adapter.mapStatus(String(result.status || 'CREATED')) : 'CREATED'
    const shipment = {
      id: shipmentRef.id,
      storeId,
      orderId: input.orderId,
      providerId,
      provider: provider.slug,
      providerName: provider.name,
      providerNameSnapshot: provider.name || null,
      providerLogoSnapshot: provider.logoUrl || provider.branding?.logoUrl || null,
      serviceCode: config.serviceCode || null,
      serviceNameSnapshot: (provider.services || []).find((service: any) => service.code === config.serviceCode)?.name || null,
      integrationType: provider.integrationType === 'api' ? 'api' : 'manual',
      externalShipmentId: result.providerShipmentId || null,
      providerShipmentId: result.providerShipmentId || null,
      trackingNumber: result.trackingNumber || (String(provider.slug || '') === 'wasla' ? waslaPublicTrackingCode(result.providerShipmentId) : null),
      trackingUrl: result.trackingUrl || null,
      labelUrl: result.labelUrl || null,
      documentAvailable: result.documentAvailable === true,
      documentProvider: result.documentAvailable === true ? String(provider.slug || '') : null,
      shippingCost: result.shippingCost ?? null,
      carrierShippingCost: result.shippingCost ?? null,
      customerShippingFee: Number(order.shippingFee || 0),
      codAmount: order.paymentMethod === 'cod' ? Number(order.totalPrice || 0) : 0,
      currentStatus: status,
      status,
      remoteStatus: result.rawStatus ?? result.status ?? null,
      active: !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(status),
      creationTrigger: input.trigger,
      idempotencyKey: guardId,
      events: [{ status, at: Timestamp.now(), source: input.trigger, note: null }],
      lastSyncedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }
    await db.runTransaction(async (tx) => {
      const [freshOrder, guardSnap, existingShipment] = await Promise.all([tx.get(orderRef), tx.get(guardRef), tx.get(shipmentRef)])
      if (existingShipment.exists || freshOrder.data()?.activeShipmentId) return
      if (!guardSnap.exists || guardSnap.data()?.processingStatus !== 'PROCESSING') throw new Error('Shipment creation guard was lost')
      tx.create(shipmentRef, shipment)
      tx.update(orderRef, {
        activeShipmentId: shipmentRef.id,
        shipmentProviderId: providerId,
        shipmentStatus: status,
        shippingCreationStatus: 'CREATED',
        shippingCreationErrorCode: null,
        shippingCreationErrorMessage: null,
        trackingNumber: result.trackingNumber || (String(provider.slug || '') === 'wasla' ? waslaPublicTrackingCode(result.providerShipmentId) : result.providerShipmentId || null),
        statusHistory: FieldValue.arrayUnion({
          status: freshOrder.data()?.status || 'NEW',
          shipmentStatus: status,
          at: Timestamp.now(),
          by: input.actorId,
          source: 'SYSTEM',
          provider: String(provider.slug || ''),
          eventId: `shipment-created-${shipmentRef.id}`,
          title: input.trigger === 'MANUAL' ? 'تم إنشاء الشحنة' : 'تم إنشاء الشحنة تلقائيًا',
        }),
        updatedAt: FieldValue.serverTimestamp(),
      })
      tx.update(guardRef, { processingStatus: 'PROCESSED', shipmentId: shipmentRef.id, processedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
      emitIntegrationEvent(db, tx, {
        storeId,
        eventType: 'shipment.created',
        entityType: 'shipment',
        entityId: shipmentRef.id,
        payload: {
          orderId: input.orderId,
          providerId,
          externalShipmentId: result.providerShipmentId || null,
          trackingNumber: shipment.trackingNumber || null,
        },
      })
    })
    return { shipment: { ...shipment, id: shipmentRef.id }, duplicate: false }
  } catch (error) {
    const details = errorDetails(error)
    await Promise.all([
      guardRef.set({ processingStatus: 'FAILED', errorCode: details.code, errorMessage: details.message.slice(0, 500), retryable: details.retryable, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      orderRef.set({
        shippingCreationStatus: 'FAILED',
        shippingCreationErrorCode: details.code,
        shippingCreationErrorMessage: details.message.slice(0, 500),
        shippingLastAttemptAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion({
          status: order.status || 'NEW',
          at: Timestamp.now(),
          by: input.actorId,
          source: 'SYSTEM',
          eventId: `shipment-create-failed-${guardId}-${Date.now()}`,
          title: 'تعذر إنشاء الشحنة',
        }),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
    ])
    throw error
  }
}
