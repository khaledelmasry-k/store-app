import type { CanonicalShipmentStatus, ShippingAdapterContext, ShippingProviderAdapter } from './types'
import { ShippingProviderError } from './bosta'
import { sanitizeSensitiveText } from '../integrations/vault'

const DEFAULT_BASE_URL = 'https://wasla.express'

function baseUrl(context: ShippingAdapterContext) {
  const configured = String((context.provider as any)?.apiBaseUrl || '').trim()
  if (configured && !/^https:\/\//i.test(configured)) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Wasla base URL must use HTTPS', false)
  return (configured || DEFAULT_BASE_URL).replace(/\/$/, '')
}

function apiKey(context: ShippingAdapterContext) {
  const key = String((context.credentials as any)?.apiKey || '').trim()
  if (!key) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Wasla API key is not configured', false)
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
        'X-API-Key': apiKey(context),
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Matjari-Shipping/1.0',
        ...(init.headers || {}),
      },
    })
    const text = await response.text()
    let body: any = null
    try { body = text ? JSON.parse(text) : null } catch { body = { message: text.slice(0, 500) } }
    if (!response.ok) {
      const message = sanitizeSensitiveText(body?.message || body?.error || `Wasla request failed (${response.status})`, [(context.credentials as any)?.apiKey])
      if (response.status === 401 || response.status === 403) throw new ShippingProviderError('INVALID_CREDENTIALS', message, false, response.status)
      if (response.status === 429 || response.status >= 500) throw new ShippingProviderError('PROVIDER_UNAVAILABLE', message, true, response.status)
      throw new ShippingProviderError('PROVIDER_REJECTED', message, false, response.status)
    }
    return body
  } catch (error) {
    if (error instanceof ShippingProviderError) throw error
    if ((error as any)?.name === 'AbortError') throw new ShippingProviderError('PROVIDER_UNAVAILABLE', 'Wasla request timed out', true)
    throw new ShippingProviderError('PROVIDER_UNAVAILABLE', 'Wasla is currently unreachable', true)
  } finally { clearTimeout(timeout) }
}

function normalized(value: unknown) {
  return String(value || '').trim().toLocaleLowerCase('ar-EG')
    .replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/[\s\-_/]+/g, '')
}

const WASLA_ITEM_CATEGORIES = new Set(['clothing', 'electronics', 'books', 'accessories', 'toys', 'cosmetics', 'home_appliances', 'office_supplies', 'mobile_devices', 'spare_parts', 'medical_supplies', 'leather', 'shoes', 'perfumes', 'jewelry', 'building_materials', 'agricultural', 'chemicals', 'other'])
function waslaItemCategory(value: unknown) {
  const category = String(value || '').trim()
  return WASLA_ITEM_CATEGORIES.has(category) ? category : 'other'
}
function locationId(map: unknown, name: unknown) {
  const source = map && typeof map === 'object' ? map as Record<string, unknown> : {}
  const direct = source[String(name || '')] ?? source[normalized(name)]
  const result = Number(direct)
  return Number.isInteger(result) && result > 0 ? result : null
}

type WaslaLocation = { id: number; name: string; pickupSupported: boolean; deliverySupported: boolean; cities: Array<{ id: number; name: string }> }

function locationRows(response: any): WaslaLocation[] {
  const data = unwrap(response)
  const rows = Array.isArray(data) ? data : Array.isArray(data?.governorates) ? data.governorates : Array.isArray(data?.locations) ? data.locations : []
  return rows.map((row: any) => ({
    // Wasla's live API commonly returns `name_ar`/`name_en` rather than a
    // generic `name`.  Prefer Arabic for the checkout's Arabic destinations.
    id: Number(row?.id), name: String(row?.name || row?.name_ar || row?.name_en || row?.title || '').trim(),
    pickupSupported: row?.pickup_supported !== false, deliverySupported: row?.delivery_supported !== false,
    cities: (Array.isArray(row?.cities) ? row.cities : []).map((city: any) => ({ id: Number(city?.id), name: String(city?.name || city?.name_ar || city?.name_en || city?.title || '').trim() }))
      .filter((city: any) => Number.isInteger(city.id) && city.id > 0 && city.name),
  })).filter((row: WaslaLocation) => Number.isInteger(row.id) && row.id > 0 && row.name)
}

async function locations(context: ShippingAdapterContext) { return locationRows(await request(context, '/api/v1/merchant/locations')) }

async function resolveDestination(context: ShippingAdapterContext, governorate: unknown, city: unknown) {
  const config = context.config || {}
  const rows = await locations(context)
  const mappedGovernorateId = locationId((config as any).waslaGovernorateIds, governorate)
  const governorateRow = rows.find((row) => row.id === mappedGovernorateId) || rows.find((row) => normalized(row.name) === normalized(governorate))
  if (!governorateRow) throw new ShippingProviderError('CONFIGURATION_ERROR', 'هذه المحافظة غير متاحة حالياً لدى وصلة', false)
  const mappedCityId = locationId((config as any).waslaCityIds, city)
  const cityRow = governorateRow.cities.find((row) => row.id === mappedCityId) || governorateRow.cities.find((row) => normalized(row.name) === normalized(city))
  if (!cityRow) throw new ShippingProviderError('CONFIGURATION_ERROR', 'هذه المدينة غير متاحة حالياً لدى وصلة', false)
  return { governorateId: governorateRow.id, cityId: cityRow.id }
}

/**
 * Wasla accepts a governorate-only shipping quote, while shipment creation
 * requires the exact delivery city.  Keep checkout pricing available when the
 * platform's city label differs slightly from Wasla's location spelling; the
 * stricter resolver above is still used before creating a shipment.
 */
async function resolveQuoteDestination(context: ShippingAdapterContext, governorate: unknown, city: unknown) {
  const config = context.config || {}
  const rows = await locations(context)
  const mappedGovernorateId = locationId((config as any).waslaGovernorateIds, governorate)
  const governorateRow = rows.find((row) => row.id === mappedGovernorateId) || rows.find((row) => normalized(row.name) === normalized(governorate))
  if (!governorateRow) throw new ShippingProviderError('CONFIGURATION_ERROR', 'هذه المحافظة غير متاحة حالياً لدى وصلة', false)
  const mappedCityId = locationId((config as any).waslaCityIds, city)
  const cityRow = governorateRow.cities.find((row) => row.id === mappedCityId) || governorateRow.cities.find((row) => normalized(row.name) === normalized(city))
  return { governorateId: governorateRow.id, cityId: cityRow?.id || null }
}

async function waslaPayload(input: Record<string, any>, context: ShippingAdapterContext) {
  const order = input.order || {}
  const config = context.config || {}
  const destination = await resolveDestination(context, order.governorate, order.city)
  const pickupGovernorateId = Number((config as any).waslaPickupGovernorateId || 0)
  const pickupCityId = Number((config as any).waslaPickupCityId || 0)
  const recipientName = String(order.customerName || '').trim()
  const phone = String(order.phone || '').trim()
  const addressLine1 = String(order.address || '').trim()
  const pickupName = String((config as any).waslaPickupLocationName || '').trim()
  const pickupPhone = String((config as any).waslaPickupContactPhone || '').trim()
  const pickupAddress = String((config as any).waslaPickupAddressLine1 || '').trim()
  if (!recipientName || !phone || !addressLine1) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Order customer name, phone, and address are required', false)
  if (!pickupName || !pickupAddress || !Number.isInteger(pickupGovernorateId) || pickupGovernorateId <= 0 || !Number.isInteger(pickupCityId) || pickupCityId <= 0) {
    throw new ShippingProviderError('CONFIGURATION_ERROR', 'Wasla pickup address is incomplete', false)
  }
  const items = Array.isArray(order.items) ? order.items : []
  if (!items.length) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Order items are required', false)
  const checkoutTotal = Math.max(
    Number(order.totalPrice || 0),
    Number(order.subtotal || 0) + Number(order.shippingFee || 0) - Number(order.discount || 0),
  )
  return {
    external_shipment_id: String(order.orderNumber || input.orderId).slice(0, 120),
    recipient_name: recipientName.slice(0, 160),
    recipient_phone: phone.slice(0, 40),
    address_line1: addressLine1.slice(0, 500),
    address_line2: null,
    governorate_id: destination.governorateId,
    city_id: destination.cityId,
    city: String(order.city || '').slice(0, 120),
    region: String(order.area || '').slice(0, 120) || null,
    country: 'EG',
    cod_amount: order.paymentMethod === 'cod' && (config as any).codEnabled !== false ? Math.max(0, checkoutTotal) : 0,
    currency: String(order.currency || 'EGP').slice(0, 8),
    allow_open_inspection: (config as any).allowOpenInspection === true,
    notes: String(order.notes || '').slice(0, 500) || null,
    metadata: { channel: 'matjari', order_id: String(input.orderId) },
    pickup_location_type: String((config as any).waslaPickupLocationType || 'merchant_store').slice(0, 60),
    pickup_location_name: pickupName.slice(0, 160),
    pickup_contact_phone: pickupPhone.slice(0, 40),
    pickup_address_line1: pickupAddress.slice(0, 500),
    pickup_governorate_id: pickupGovernorateId,
    pickup_city_id: pickupCityId,
    items: items.slice(0, 100).map((item: any) => ({
      source: 'custom',
      category: waslaItemCategory(item.category),
      description: `${String(item.name || 'Item')} × ${Math.max(1, Number(item.quantity || 1))}`.slice(0, 500),
      quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
      declared_value: Math.max(0, Number(item.price || item.unitPrice || 0)),
      weight_kg: Math.max(0.01, Number(item.weightKg || item.weight || (config as any).defaultPackageWeight || 1)),
    })),
  }
}

function unwrap(response: any) { return response?.data || response || {} }
function trackingIdentity(data: any) {
  return String(
    data?.tracking_number || data?.trackingNumber || data?.tracking_code || data?.trackingCode || data?.awb
    || data?.shipment_code || data?.shipmentCode || data?.reference_code
    || data?.referenceCode || data?.tracking?.number || data?.tracking?.code || ''
  )
}
function shipmentIdentity(data: any) { return String(data?.public_id || data?.publicId || data?.shipment_id || data?.id || trackingIdentity(data) || '') }

/**
 * Wasla prints its scannable shipment code under the barcode as WS + the
 * first UUID segment + EG. Their merchant API may omit that field, while the
 * UUID remains the identifier required by the API itself.
 */
export function waslaPublicTrackingCode(value: unknown): string | null {
  const text = String(value || '').trim()
  if (!text) return null
  if (/^WS[0-9a-f]{8}EG$/i.test(text)) return text
  const uuidStart = text.match(/^([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)?.[1]
  return uuidStart ? `WS${uuidStart.toLowerCase()}EG` : null
}

export function mapWaslaStatus(value: unknown): CanonicalShipmentStatus {
  const status = String(value || '').toUpperCase().replace(/[\s-]+/g, '_')
  if (/تم_التسليم|سُلِّم|سلمت/.test(status)) return 'DELIVERED'
  if (/خرج_للتسليم|قيد_التسليم/.test(status)) return 'OUT_FOR_DELIVERY'
  if (/تم_الاستلام|تم_استلامها/.test(status)) return 'PICKED_UP'
  if (/جاهز_للاستلام|جاهزة_للاستلام/.test(status)) return 'READY_FOR_PICKUP'
  if (/في_المخزن|قيد_الشحن|في_الطريق/.test(status)) return 'IN_TRANSIT'
  if (/جاري_الإرجاع|قيد_الإرجاع/.test(status)) return 'RETURNING'
  if (/تم_الإرجاع|مرتجع/.test(status)) return 'RETURNED'
  if (/تعذر_التسليم|فشل_التسليم|فشل/.test(status)) return 'FAILED'
  if (/ملغي|ألغيت/.test(status)) return 'CANCELLED'
  if (/DELIVERED|COMPLETED/.test(status)) return 'DELIVERED'
  if (/OUT_FOR_DELIVERY|ASSIGNED_FOR_DELIVERY/.test(status)) return 'OUT_FOR_DELIVERY'
  if (/PICKED_UP/.test(status)) return 'PICKED_UP'
  if (/PICKUP_ASSIGNED|READY/.test(status)) return 'READY_FOR_PICKUP'
  if (/AT_WAREHOUSE|IN_TRANSIT|SHIPPED|ON_THE_WAY/.test(status)) return 'IN_TRANSIT'
  if (/RETURNING/.test(status)) return 'RETURNING'
  if (/RETURNED/.test(status)) return 'RETURNED'
  if (/CANCELLED|CANCELED/.test(status)) return 'CANCELLED'
  if (/FAILED|REJECTED|UNDELIVERABLE|DAMAGED|LOST/.test(status)) return 'FAILED'
  return 'CREATED'
}

export const waslaAdapter: ShippingProviderAdapter = {
  slug: 'wasla',
  capabilities: ['createShipment', 'tracking', 'timeline', 'cod', 'idempotency', 'locations', 'rates'],
  async testConnection(context) {
    const data = unwrap(await request(context, '/api/v1/merchant/me'))
    return { ok: true, message: 'Wasla API key was validated by the provider', account: String(data?.name || data?.public_id || data?.code || '') || null }
  },
  async createShipment(context, input) {
    const response = unwrap(await request(context, '/api/v1/merchant/shipments', {
      method: 'POST',
      headers: { 'Idempotency-Key': String(input.idempotencyKey || input.orderId || '') },
      body: JSON.stringify(await waslaPayload(input, context)),
    }))
    const providerShipmentId = shipmentIdentity(response)
    if (!providerShipmentId) throw new ShippingProviderError('PROVIDER_REJECTED', 'Wasla response did not include a shipment identifier', false)
    // Keep the carrier's opaque identifier private. Matjari creates its own
    // stable public tracking code when Wasla has not issued an AWB.
    const trackingNumber = trackingIdentity(response) || null
    const rawStatus = String(response?.status || response?.shipment_status || 'CREATED')
    return {
      providerShipmentId, trackingNumber, trackingUrl: null, status: rawStatus, rawStatus,
      shippingCost: Number(response?.shipping_fee_amount ?? 0),
      currency: String(response?.shipping_fee_currency || response?.currency || 'EGP'),
    }
  },
  async trackShipment(context, input) {
    const identity = encodeURIComponent(String(input.providerShipmentId || input.trackingNumber || ''))
    if (!identity) throw new ShippingProviderError('CONFIGURATION_ERROR', 'Shipment identifier is required', false)
    const [data, timelineResponse] = await Promise.all([
      request(context, `/api/v1/merchant/shipments/${identity}`),
      request(context, `/api/v1/merchant/shipments/${identity}/timeline`).catch(() => null),
    ]).then(([shipment, timeline]) => [unwrap(shipment), timeline ? unwrap(timeline) : []])
    const timeline = Array.isArray(timelineResponse) ? timelineResponse : []
    const latestTimelineEvent = [...timeline].reverse()[0] || {}
    const latestNote = [...timeline].reverse().map((event: any) => String(event?.note || event?.metadata?.reason || event?.metadata?.failure_reason || '')).find(Boolean) || null
    const attempts = Array.isArray(data?.delivery_attempts) ? data.delivery_attempts : Array.isArray(data?.deliveryAttempts) ? data.deliveryAttempts : Array.isArray(data?.attempts) ? data.attempts : []
    const latestAttempt = [...attempts].reverse()[0] || {}
    const providerShipmentId = shipmentIdentity(data) || String(input.providerShipmentId || '')
    return {
      providerShipmentId,
      trackingNumber: trackingIdentity(data) || waslaPublicTrackingCode(providerShipmentId) || String(input.trackingNumber || ''),
      status: String(data?.status || data?.shipment_status || ''),
      failureReason: data?.failure_reason || data?.failureReason || data?.status_reason || data?.reason || data?.metadata?.reason || latestAttempt?.reason || latestAttempt?.failure_reason || latestAttempt?.failureReason || latestTimelineEvent?.reason || latestNote,
      shippingCost: Number(data?.shipping_fee_amount ?? 0),
      raw: data,
    }
  },
  async getLocations(context) {
    return (await locations(context)).map((row) => ({ id: row.id, name: row.name, pickupSupported: row.pickupSupported, deliverySupported: row.deliverySupported, cities: row.cities }))
  },
  async getRates(context, input) {
    const config = context.config || {}
    const pickupGovernorateId = Number((config as any).waslaPickupGovernorateId || 0)
    const pickupCityId = Number((config as any).waslaPickupCityId || 0)
    if (!Number.isInteger(pickupGovernorateId) || pickupGovernorateId <= 0 || !Number.isInteger(pickupCityId) || pickupCityId <= 0) return []
    const destination = await resolveQuoteDestination(context, input.governorate, input.city)
    // Wasla's rate rules are normally governorate-level. City IDs are optional
    // and some merchants have narrower city records that would hide an active
    // governorate rule (e.g. Cairo → Alexandria). Use the canonical route for
    // the customer price; exact city IDs remain mandatory during shipment creation.
    const query = new URLSearchParams({
      pickup_governorate_id: String(pickupGovernorateId),
      delivery_governorate_id: String(destination.governorateId),
    })
    const quote = unwrap(await request(context, `/api/v1/merchant/shipping-quote?${query.toString()}`))
    if (quote?.covered !== true) return []
    const amount = Math.max(0, Number(quote?.shipping_fee_amount || 0))
    // `standard` is the public service code configured for Wasla in the
    // platform.  Returning a different internal identifier here made a
    // correctly selected Wasla service disappear during checkout filtering.
    return [{ serviceCode: 'standard', serviceName: String((context.provider as any)?.name || 'وصلة'), amount, price: amount, currency: String(quote?.shipping_fee_currency || input.currency || 'EGP'), codAvailable: (config as any).codEnabled !== false, trackingAvailable: true, weightKg: Math.max(0, Number(input.weightKg || 0)), zoneId: quote?.shipping_fee_rule_id || null }]
  },
  mapStatus: mapWaslaStatus,
}
