import { timingSafeEqual } from 'node:crypto'
import type { CanonicalShipmentStatus, ShippingAdapterContext, ShippingProviderAdapter } from './types'
import { sanitizeSensitiveText } from '../integrations/vault'

const DEFAULT_BASE_URL = 'https://app.bosta.co/api/v2'

export class ShippingProviderError extends Error {
  constructor(
    public readonly code: 'INVALID_CREDENTIALS' | 'PROVIDER_UNAVAILABLE' | 'CONFIGURATION_ERROR' | 'PROVIDER_REJECTED' | 'MAPPING_MISSING' | 'NOT_COVERED' | 'NO_PROVIDER',
    message: string,
    public readonly retryable: boolean,
    public readonly httpStatus?: number,
  ) { super(message) }
}

function baseUrl(context: ShippingAdapterContext) {
  const configured = String((context.provider as any)?.apiBaseUrl || '').trim()
  const emulatorHttp = process.env.FUNCTIONS_EMULATOR === 'true' && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(configured)
  if (configured && !/^https:\/\//i.test(configured) && !emulatorHttp) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Bosta base URL must use HTTPS', false)
  return (configured || DEFAULT_BASE_URL).replace(/\/$/, '')
}

function apiKey(context: ShippingAdapterContext) {
  const key = String((context.credentials as any)?.apiKey || '').trim()
  if (!key) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Bosta API key is not configured', false)
  return key
}

async function request(context: ShippingAdapterContext, path: string, init: RequestInit = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(`${baseUrl(context)}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: apiKey(context),
        'Content-Type': 'application/json',
        'User-Agent': 'MK-Store-Shipping/1.0',
        ...(init.headers || {}),
      },
    })
    const text = await response.text()
    let body: any = null
    try { body = text ? JSON.parse(text) : null } catch { body = { message: text.slice(0, 500) } }
    if (!response.ok) {
      const message = sanitizeSensitiveText(
        body?.message || body?.error || `Bosta request failed (${response.status})`,
        [(context.credentials as any)?.apiKey, (context.credentials as any)?.webhookSecret],
      )
      if (response.status === 401 || response.status === 403) throw new ShippingProviderError('INVALID_CREDENTIALS', message, false, response.status)
      if (response.status >= 500 || response.status === 429) throw new ShippingProviderError('PROVIDER_UNAVAILABLE', message, true, response.status)
      throw new ShippingProviderError('PROVIDER_REJECTED', message, false, response.status)
    }
    return body
  } catch (error) {
    if (error instanceof ShippingProviderError) throw error
    if ((error as any)?.name === 'AbortError') throw new ShippingProviderError('PROVIDER_UNAVAILABLE', 'Bosta request timed out', true)
    throw new ShippingProviderError('PROVIDER_UNAVAILABLE', 'Bosta is currently unreachable', true)
  } finally {
    clearTimeout(timeout)
  }
}

async function shipmentDocument(context: ShippingAdapterContext, trackingNumber: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(`${baseUrl(context)}/deliveries/mass-awb`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: apiKey(context),
        'Content-Type': 'application/json',
        'User-Agent': 'MK-Store-Shipping/1.0',
      },
      body: JSON.stringify({ trackingNumbers: trackingNumber, requestedAwbType: 'A4', lang: 'ar' }),
    })
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!response.ok) {
      throw new ShippingProviderError(
        response.status === 401 || response.status === 403 ? 'INVALID_CREDENTIALS' : response.status >= 500 || response.status === 429 ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_REJECTED',
        sanitizeSensitiveText(bytes.toString('utf8') || `Bosta AWB request failed (${response.status})`, [(context.credentials as any)?.apiKey]),
        response.status >= 500 || response.status === 429,
        response.status,
      )
    }
    let pdf = bytes
    if (!bytes.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      const text = bytes.toString('utf8').trim()
      let candidate: unknown = text
      try {
        const parsed = JSON.parse(text)
        candidate = parsed?.data?.base64 || parsed?.data || parsed?.base64 || parsed?.file || parsed
      } catch { /* Bosta may return the Base64 string as plain text. */ }
      const encoded = String(candidate || '').replace(/^data:application\/pdf;base64,/i, '').replace(/\s+/g, '')
      if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new ShippingProviderError('PROVIDER_REJECTED', 'Bosta did not return a printable AWB document', false)
      pdf = Buffer.from(encoded, 'base64')
    }
    if (pdf.length === 0 || pdf.length > 8 * 1024 * 1024) throw new ShippingProviderError('PROVIDER_REJECTED', 'Bosta AWB document size is invalid', false)
    return pdf.toString('base64')
  } catch (error) {
    if (error instanceof ShippingProviderError) throw error
    if ((error as any)?.name === 'AbortError') throw new ShippingProviderError('PROVIDER_UNAVAILABLE', 'Bosta AWB request timed out', true)
    throw new ShippingProviderError('PROVIDER_UNAVAILABLE', 'Bosta AWB is currently unavailable', true)
  } finally { clearTimeout(timeout) }
}

function orderPayload(input: Record<string, any>, context: ShippingAdapterContext) {
  const order = input.order || {}
  const config = context.config || {}
  const phone = String(order.phone || '').trim()
  const secondaryPhone = String(order.secondaryPhone || '').trim()
  const addressLine = [order.address, order.area, order.city, order.governorate].map((value) => String(value || '').trim()).filter(Boolean).join('، ')
  if (!order.customerName || !phone || !addressLine) {
    throw new ShippingProviderError('CONFIGURATION_ERROR', 'Order customer name, phone, and address are required', false)
  }
  const items = Array.isArray(order.items) ? order.items : []
  const description = items.map((item: any) => `${String(item.name || 'Item')} × ${Number(item.quantity || 1)}`).join('، ').slice(0, 200)
  const cod = order.paymentMethod === 'cod' ? Math.max(0, Number(order.totalPrice || 0)) : 0
  return {
    type: 10,
    businessReference: String(order.orderNumber || input.orderId).slice(0, 120),
    receiver: {
      firstName: String(order.customerName).slice(0, 100),
      phone,
      ...(secondaryPhone ? { secondPhone: secondaryPhone } : {}),
    },
    dropOffAddress: {
      firstLine: addressLine.slice(0, 250),
      city: String(order.city || order.governorate || '').slice(0, 100),
      zone: String(order.area || '').slice(0, 100),
      district: String(order.area || '').slice(0, 100),
    },
    cod,
    notes: String(order.notes || '').slice(0, 200),
    specs: {
      packageType: String((config as any).packageType || 'SMALL'),
      packageDetails: {
        description: description || `Order ${String(order.orderNumber || input.orderId)}`,
        itemsCount: items.reduce((sum: number, item: any) => sum + Math.max(1, Number(item.quantity || 1)), 0) || 1,
      },
    },
    ...(config.pickupAddressId ? { businessLocationId: String(config.pickupAddressId) } : {}),
    ...(input.webhookUrl ? {
      webhookUrl: String(input.webhookUrl),
      ...((context.credentials as any)?.webhookSecret ? { webhookCustomHeaders: { Authorization: String((context.credentials as any).webhookSecret) } } : {}),
    } : {}),
  }
}

export function mapBostaStatus(value: string | number): CanonicalShipmentStatus {
  const status = Number(value)
  if (status === 10 || status === 11 || status === 20) return 'CREATED'
  if (status === 21 || status === 23) return 'PICKED_UP'
  if (status === 24 || status === 30 || status === 25) return 'IN_TRANSIT'
  if (status === 22 || status === 40 || status === 41) return 'OUT_FOR_DELIVERY'
  if (status === 45) return 'DELIVERED'
  if (status === 46 || status === 60) return 'RETURNED'
  if (status === 47 || status === 100 || status === 101 || status === 102 || status === 103 || status === 105) return 'FAILED'
  if (status === 48 || status === 49 || status === 104) return 'CANCELLED'
  return 'CREATED'
}

export const bostaAdapter: ShippingProviderAdapter = {
  slug: 'bosta',
  capabilities: ['createShipment', 'tracking', 'cancel', 'webhooks', 'cod', 'awb'],
  async testConnection(context) {
    await request(context, '/businesses/deliveries?limit=1&page=0')
    return { ok: true, message: 'Bosta credentials were validated by the provider' }
  },
  async createShipment(context, input) {
    const response = await request(context, '/deliveries?apiVersion=1', {
      method: 'POST',
      headers: { 'Idempotency-Key': String(input.idempotencyKey || input.orderId || '') },
      body: JSON.stringify(orderPayload(input as Record<string, any>, context)),
    })
    const data = response?.data || response
    const providerShipmentId = String(data?._id || data?.id || data?.delivery?._id || '')
    const trackingNumber = String(data?.trackingNumber || data?.delivery?.trackingNumber || '')
    if (!providerShipmentId && !trackingNumber) throw new ShippingProviderError('PROVIDER_REJECTED', 'Bosta response did not include a shipment identifier', false)
    return {
      providerShipmentId: providerShipmentId || trackingNumber,
      trackingNumber: trackingNumber || null,
      trackingUrl: trackingNumber ? `https://bosta.co/tracking-shipment/?track_num=${encodeURIComponent(trackingNumber)}` : null,
      status: String(data?.state?.code ?? data?.state ?? 10),
      shippingCost: data?.price ?? data?.shippingCost ?? null,
      rawStatus: data?.state ?? null,
      documentAvailable: Boolean(trackingNumber),
    }
  },
  async trackShipment(context, input) {
    const identity = encodeURIComponent(String(input.trackingNumber || input.providerShipmentId || ''))
    if (!identity) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Shipment identifier is required', false)
    const response = await request(context, `/businesses/deliveries/${identity}`)
    const data = response?.data || response
    return {
      providerShipmentId: String(data?._id || input.providerShipmentId || ''),
      trackingNumber: String(data?.trackingNumber || input.trackingNumber || ''),
      status: String(data?.state?.code ?? data?.state ?? ''),
      raw: data,
    }
  },
  async cancelShipment(context, input) {
    const identity = encodeURIComponent(String(input.trackingNumber || input.providerShipmentId || ''))
    if (!identity) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Shipment identifier is required', false)
    await request(context, `/deliveries/${identity}`, { method: 'DELETE' })
  },
  async getShipmentDocument(context, input) {
    const trackingNumber = String(input.trackingNumber || '').trim()
    if (!trackingNumber) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Tracking number is required for the AWB document', false)
    return {
      contentBase64: await shipmentDocument(context, trackingNumber),
      contentType: 'application/pdf',
      fileName: `bosta-awb-${trackingNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
    }
  },
  parseWebhook(payload) {
    const raw = payload && typeof payload === 'object' ? payload as Record<string, any> : {}
    const providerShipmentId = String(raw._id || raw.id || '')
    const trackingNumber = String(raw.trackingNumber || '')
    const state = String(raw.state ?? '')
    if ((!providerShipmentId && !trackingNumber) || !state) throw new Error('Invalid Bosta webhook payload')
    return {
      externalEventId: `${providerShipmentId || trackingNumber}:${state}:${String(raw.timeStamp || '')}`,
      providerShipmentId,
      trackingNumber,
      externalStatus: state,
      status: mapBostaStatus(state),
      occurredAt: raw.timeStamp || null,
      businessReference: raw.businessReference || null,
      raw: raw,
    }
  },
  verifyWebhookSignature(_payload, headers, credentials) {
    const expected = String(credentials.webhookSecret || '').trim()
    if (!expected) return false
    const providedRaw = headers.authorization
    const provided = String(Array.isArray(providedRaw) ? providedRaw[0] : providedRaw || '')
    const a = Buffer.from(expected)
    const b = Buffer.from(provided)
    return a.length === b.length && timingSafeEqual(a, b)
  },
  mapStatus: mapBostaStatus,
}
