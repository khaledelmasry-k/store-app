import type { Firestore, Transaction } from 'firebase-admin/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'

export type IntegrationEventType =
  | 'order.created'
  | 'order.confirmed'
  | 'order.cancelled'
  | 'shipment.created'
  | 'shipment.status_changed'
  | 'shipment.delivered'
  | 'shipment.returned'
  | 'customer.created'
  | 'store.published'

export type IntegrationEventInput = {
  eventId?: string
  storeId: string
  eventType: IntegrationEventType
  entityType: string
  entityId: string
  payload: Record<string, unknown>
}

export function integrationEventDocument(input: IntegrationEventInput) {
  const eventId = input.eventId || randomUUID()
  return {
    eventId,
    storeId: input.storeId,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload,
    createdAt: FieldValue.serverTimestamp(),
    processingStatus: 'PENDING',
    attempts: 0,
    lastAttemptAt: null,
    processedAt: null,
    errorCode: null,
    errorMessage: null,
  }
}

export function emitIntegrationEvent(db: Firestore, tx: Transaction | null, input: IntegrationEventInput) {
  const data = integrationEventDocument(input)
  const ref = db.doc(`integrationEvents/${data.eventId}`)
  if (tx) tx.create(ref, data)
  else return ref.create(data)
  return ref
}
