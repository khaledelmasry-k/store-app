import * as admin from 'firebase-admin'
import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore'
import { onCall, onRequest, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { onObjectFinalized, onObjectDeleted } from 'firebase-functions/v2/storage'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { createHash, randomBytes } from 'node:crypto'
import { CANONICAL_PLANS } from './planCatalog'
import { getShippingAdapter, getShippingRateAdapter, listShippingAdapters } from './shipping/registry'
import { credentialSummary, encryptCredentials, sanitizeCredentials, sanitizeSensitiveText } from './integrations/vault'
import { emitIntegrationEvent } from './integrations/outbox'
import { createShipmentForOrder, credentialDocumentId, loadIntegrationCredentials, publicWebhookUrl } from './shipping/service'
import { ShippingProviderError } from './shipping/bosta'
import { waslaPublicTrackingCode } from './shipping/wasla'

admin.initializeApp()

// Bucket the app uploads to (matches VITE_FIREBASE_STORAGE_BUCKET). The Storage
// triggers below watch THIS bucket so the `storageUsed` counter stays in sync
// with real merchant uploads. Override via STORAGE_BUCKET when self-hosting.
const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET || `${process.env.GCLOUD_PROJECT || 'mk-store-app'}.firebasestorage.app`

const db = admin.firestore()
const auth = admin.auth()
const integrationVaultKey = defineSecret('INTEGRATION_VAULT_KEY')
const SHIPPING_FUNCTION_REGION = 'us-central1'

function storePublicationStatus(data: any): 'draft' | 'published' | 'suspended' {
  if (data?.storeStatus === 'suspended' || data?.status === 'suspended') return 'suspended'
  if (data?.storeStatus === 'published') return 'published'
  if (data?.storeStatus === 'draft') return 'draft'
  return data?.published === true ? 'published' : 'draft'
}

function publicStoreData(data: any) {
  if (!data) return null
  const storeStatus = storePublicationStatus(data)
  return { name: data.name || '', slug: data.slug || '', logo: data.logo || null, hero: data.hero || null, heroImage: data.heroImage || null, description: data.description || '', seoTitle: data.seoTitle || null, seoDescription: data.seoDescription || null, theme: data.theme || {}, currency: data.currency || 'SAR', phone: data.publicPhone || data.phone || null, storeStatus, published: storeStatus === 'published', active: data.active !== false && data.merchantSuspended !== true && data.merchantLifecycleStatus !== 'deleting', updatedAt: now() }
}

function publicProductData(data: any) {
  if (!data) return null
  return {
    storeId: data.storeId,
    name: data.name || '',
    description: data.description || '',
    images: data.images || [],
    price: Number(data.price || 0),
    oldPrice: data.oldPrice == null ? null : Number(data.oldPrice),
    stock: Number(data.stock || 0),
    active: data.active === true,
    isFeatured: data.isFeatured === true || data.featured === true,
    categoryId: data.categoryId || null,
    variants: (data.variants || []).map((v: any) => ({
      id: v.id || null,
      color: v.color || '',
      size: v.size || '',
      stock: Number(v.stock || 0),
      ...(v.price == null ? {} : { price: Number(v.price) }),
    })),
    colors: data.colors || [],
    sizes: data.sizes || [],
    colorOptions: data.colorOptions || [],
    pricingMode: data.pricingMode || 'unit',
    quantityTiers: data.quantityTiers || [],
    quantityPricingStrategy: data.quantityPricingStrategy || 'cap',
    updatedAt: now(),
  }
}

export const projectStorePublicData = onDocumentWritten('stores/{storeId}', async (event) => {
  const ref = db.doc(`publicStores/${event.params.storeId}`)
  if (!event.data?.after.exists) return ref.delete()
  return ref.set(publicStoreData(event.data.after.data())!, { merge: true })
})

export const projectProductPublicData = onDocumentWritten('products/{productId}', async (event) => {
  const after = event.data?.after
  const before = event.data?.before.data()
  const storeId = after?.exists ? after.data()?.storeId : before?.storeId
  if (!storeId) return
  const ref = db.doc(`publicStores/${storeId}/products/${event.params.productId}`)
  if (!after?.exists || after.data()?.active !== true) return ref.delete()
  return ref.set(publicProductData(after.data())!, { merge: true })
})

export const projectCategoryPublicData = onDocumentWritten('categories/{categoryId}', async (event) => {
  const after = event.data?.after
  const before = event.data?.before.data()
  const storeId = after?.exists ? after.data()?.storeId : before?.storeId
  if (!storeId) return
  const ref = db.doc(`publicStores/${storeId}/categories/${event.params.categoryId}`)
  if (!after?.exists || after.data()?.active === false) return ref.delete()
  const data = after.data() || {}
  return ref.set({ storeId, name: data.name || '', image: data.image || null, active: true, sortOrder: Number(data.sortOrder || 0), updatedAt: now() }, { merge: true })
})

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const now = () => FieldValue.serverTimestamp()

function tsFromDate(d: Date) {
  return Timestamp.fromDate(d)
}

function toMillis(value: any): number | null {
  if (value == null) return null
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isFinite(t) ? t : null
  }
  if (typeof value === 'string') {
    const t = Date.parse(value)
    return Number.isFinite(t) ? t : null
  }
  if (typeof value === 'object') {
    if (typeof (value as any).toMillis === 'function') {
      try {
        const m = (value as any).toMillis()
        return typeof m === 'number' && Number.isFinite(m) ? m : null
      } catch {
        return null
      }
    }
    if (typeof (value as any).toDate === 'function') {
      try {
        const d = (value as any).toDate()
        const t = d instanceof Date ? d.getTime() : Date.parse(String(d))
        return Number.isFinite(t) ? t : null
      } catch {
        return null
      }
    }
    const sec = (value as any).seconds ?? (value as any)._seconds ?? (value as any)._sec ?? null
    if (sec != null) {
      const s = typeof sec === 'number' ? sec : typeof sec === 'string' ? Number(sec) : NaN
      if (Number.isFinite(s)) {
        const nano = (value as any).nanoseconds ?? (value as any)._nanoseconds ?? (value as any).nanos ?? 0
        const n = typeof nano === 'number' ? nano : typeof nano === 'string' ? Number(nano) : 0
        return s * 1000 + (Number.isFinite(n) ? Math.floor(n / 1e6) : 0)
      }
    }
  }
  return null
}

// Mirrors src/shared/utils/pricing.ts (client). Functions is a separate
// package, so tier resolution is duplicated here on purpose and must stay in
// sync. Never accept a client-supplied price.
//
// Model: a tier is a BUNDLE of exactly `quantity` pieces priced at a TOTAL
// `price`. The line total is the tier's total price — it is NEVER multiplied
// by the quantity again. Legacy tiers with `minQuantity`/`maxQuantity` keep
// their old unit-price semantics and are detected automatically.
function isBundleTier(t: any): boolean {
  return typeof t?.quantity === 'number' && Number.isFinite(t.quantity)
}

/** Per-unit base price for remainder units: the qty:1 tier, else `fallback`. */
function baseUnitPrice(tiers: any[] | null | undefined, fallback: number): number {
  const t1 = (tiers || []).find((t: any) => isBundleTier(t) && t.quantity === 1)
  if (t1 && typeof t1.price === 'number') return t1.price
  return fallback || 0
}

/**
 * Total price for `qty` pieces under quantity (bundle) pricing.
 * Mirrors src/shared/utils/pricing.ts. For quantities beyond the highest
 * configured tier, `strategy` (default 'cap') decides the overflow behavior:
 *   - 'cap'    : highest bundle total + remainder at base unit price.
 *   - 'repeat' : repeat the highest bundle, remainder at base unit price.
 *   - 'last'   : always the highest bundle total once.
 */
function quantityTotalPrice(
  tiers: any[] | null | undefined,
  qty: number,
  strategy: string = 'cap',
  fallbackBase = 0,
): number | null {
  const sorted = [...(tiers || [])]
    .filter((t: any) => isBundleTier(t))
    .sort((a: any, b: any) => Number(a.quantity) - Number(b.quantity))
  if (sorted.length === 0 || qty < 1) return null
  const base = baseUnitPrice(tiers, fallbackBase)
  const highest = sorted[sorted.length - 1]
  const exact = sorted.find((t: any) => t.quantity === qty)
  const largestBelow = [...sorted].reverse().find((t: any) => t.quantity < qty) || null

  if (strategy === 'last') {
    if (exact) return exact.price
    if (qty >= Number(highest.quantity)) return highest.price
    if (largestBelow) return largestBelow.price + (qty - Number(largestBelow.quantity)) * base
    return qty * base
  }
  if (strategy === 'repeat') {
    let remaining = qty
    let total = 0
    while (remaining > 0) {
      const t = [...sorted].reverse().find((x: any) => x.quantity <= remaining) || null
      if (t) {
        total += t.price
        remaining -= t.quantity
      } else {
        total += base * remaining
        remaining = 0
      }
    }
    return total
  }
  // 'cap' (default)
  if (exact) return exact.price
  if (qty > Number(highest.quantity)) return highest.price + (qty - Number(highest.quantity)) * base
  if (largestBelow) return largestBelow.price + (qty - Number(largestBelow.quantity)) * base
  return qty * base
}

function tierForQuantity(tiers: any[] | null | undefined, qty: number): any | null {
  if (!tiers || tiers.length === 0 || qty < 1) return null
  const sorted = [...tiers].sort((a, b) => Number(isBundleTier(a) ? a.quantity : a.minQuantity || 0) - Number(isBundleTier(b) ? b.quantity : b.minQuantity || 0))
  for (const t of sorted) {
    if (isBundleTier(t)) {
      if (qty === Number(t.quantity)) return t
    } else if (qty >= Number(t.minQuantity) && (t.maxQuantity == null || qty <= Number(t.maxQuantity))) {
      return t
    }
  }
  const last = sorted[sorted.length - 1]
  if (last && !isBundleTier(last) && last.maxQuantity != null && qty > Number(last.maxQuantity)) return last
  return null
}

/** Total price for a quantity under bundle pricing, else null. */
function tierTotalForQuantity(tiers: any[] | null | undefined, qty: number, strategy: string = 'cap'): number | null {
  if (tiers && tiers.length > 0 && tiers.every(isBundleTier)) {
    return quantityTotalPrice(tiers, qty, strategy, 0)
  }
  return null
}

function unitPriceForQty(basePrice: number, qty: number, pricingMode?: string | null, tiers?: any[] | null, strategy: string = 'cap'): number {
  if (pricingMode === 'quantity') {
    const total = quantityTotalPrice(tiers, qty, strategy, basePrice)
    if (total != null) return total
  }
  return basePrice || 0
}

async function getUserRole(uid: string): Promise<string | null> {
  try {
    const snap = await db.doc(`users/${uid}`).get()
    return snap.exists ? (snap.data()?.role as string) || null : null
  } catch {
    return null
  }
}

// Legacy compatibility fallback for stores that have not been migrated to an
// enabled platform provider. New provider quotes are resolved by the adapter
// registry; never trust a client-supplied shipping fee.
function isFreeShipping(threshold: number | undefined | null, subtotal: number) {
  return !!threshold && threshold > 0 && subtotal >= threshold
}

function computeShippingFee(cfg: any, zones: any[], subtotal: number, governorate: string): { fee: number; method: string; policy: string; available: boolean; unavailableReason?: string; snapshot: any } {
  const showPolicy = () => (cfg?.refusedPolicyEnabled !== false ? cfg?.refusedPolicy || '' : '')
  if (!cfg?.enabled) return { fee: 0, method: 'بدون شحن', policy: showPolicy(), available: true, snapshot: { enabled: false, customerShippingFee: 0 } }
  if (cfg.model === 'flat') {
    const providers = Array.isArray(cfg.providers) ? cfg.providers : []
    let provider = cfg.defaultProviderId ? providers.find((p: any) => p.id === cfg.defaultProviderId && p.active) : null
    if (!provider) provider = providers.find((p: any) => p.active) || null
    const hasRule = Boolean(provider || cfg.flatFee != null || cfg.freeAbove != null)
    if (!hasRule) return { fee: 0, method: 'الشحن غير متوفر', policy: showPolicy(), available: false, unavailableReason: 'لا توجد قاعدة شحن مفعّلة', snapshot: { enabled: true, model: 'flat', customerShippingFee: 0 } }
    if (isFreeShipping(cfg.freeAbove, subtotal)) {
      return { fee: 0, method: 'توصيل مجاني', policy: showPolicy(), available: true, snapshot: { enabled: true, model: 'flat', freeDelivery: true, providerId: provider?.id || null, customerShippingFee: 0 } }
    }
    const fee = provider?.fee ?? cfg.flatFee ?? 0
    return {
      fee,
      method: provider?.name || 'شحن',
      policy: showPolicy(),
      available: true,
      snapshot: { enabled: true, model: 'flat', providerId: provider?.id || null, customerShippingFee: fee },
    }
  }
  // zones model
  const zone = (zones || []).find((z: any) => z.active && Array.isArray(z.governorates) && z.governorates.includes(governorate))
  if (!zone) {
    return { fee: 0, method: 'الشحن غير متوفر لهذه المنطقة', policy: showPolicy(), available: false, unavailableReason: 'لا توجد قاعدة شحن لهذه المحافظة', snapshot: { enabled: true, model: 'zones', zoneId: null, customerShippingFee: 0 } }
  }
  if (isFreeShipping(zone.freeAbove, subtotal)) {
    return { fee: 0, method: `${zone.name} — توصيل مجاني`, policy: showPolicy(), available: true, snapshot: { enabled: true, model: 'zones', zoneId: zone.id, providerId: zone.providerId || null, freeDelivery: true, customerShippingFee: 0 } }
  }
  return {
    fee: zone.fee || 0,
    method: zone.name || 'شحن',
    policy: showPolicy(),
    available: true,
    snapshot: { enabled: true, model: 'zones', zoneId: zone.id, providerId: zone.providerId || null, customerShippingFee: zone.fee || 0 },
  }
}

const SHIPPING_PROVIDER_STATUSES = ['active', 'inactive', 'draft'] as const
const SHIPPING_INTEGRATION_TYPES = ['api', 'manual'] as const
const SHIPPING_CREDENTIAL_MODES = ['platform', 'merchant', 'hybrid'] as const
const SHIPPING_RATE_MODES = ['api', 'fixed', 'zone', 'weight', 'hybrid'] as const

function normalizeZoneRules(input: any) {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const coverageOverlaps = (left: any, right: any) => {
    const dimensions = ['governorates', 'cities', 'areas']
    const has = (rule: any, key: string) => Array.isArray(rule?.[key]) && rule[key].length > 0
    for (const key of dimensions) {
      if (has(left, key) && has(right, key) && left[key].some((value: string) => right[key].includes(value))) return true
    }
    return !dimensions.some((key) => has(left, key)) || !dimensions.some((key) => has(right, key))
  }
  const normalizedRules: any[] = []
  for (const rule of input.slice(0, 100)) {
    const zoneId = String(rule?.zoneId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 80)
    const zoneName = String(rule?.zoneName || '').trim().slice(0, 120)
    if (!zoneId || !zoneName || seen.has(zoneId)) throw new HttpsError('invalid-argument', 'كل منطقة تحتاج معرفاً واسماً فريداً')
    seen.add(zoneId)
    const number = (value: any, label: string, allowNull = false) => {
      if (allowNull && (value === undefined || value === null || value === '')) return undefined
      const parsed = Number(value || 0)
      if (!Number.isFinite(parsed) || parsed < 0) throw new HttpsError('invalid-argument', `قيمة ${label} غير صالحة`)
      return parsed
    }
    const etaMin = number(rule?.etaMin, 'الحد الأدنى للمدة', true)
    const etaMax = number(rule?.etaMax, 'الحد الأقصى للمدة', true)
    if (etaMin !== undefined && etaMax !== undefined && etaMax < etaMin) throw new HttpsError('invalid-argument', 'الحد الأقصى للمدة يجب أن يكون أكبر من الحد الأدنى')
    const list = (value: any) => Array.isArray(value) ? Array.from(new Set(value.map((entry) => String(entry).trim()).filter(Boolean))).slice(0, 100) : []
    const normalized = {
      zoneId,
      zoneName,
      country: String(rule?.country || 'EG').slice(0, 8),
      governorates: list(rule?.governorates),
      cities: list(rule?.cities),
      areas: list(rule?.areas),
      excludedGovernorates: list(rule?.excludedGovernorates),
      excludedCities: list(rule?.excludedCities),
      excludedAreas: list(rule?.excludedAreas),
      baseRate: number(rule?.baseRate, 'السعر الأساسي') || 0,
      codFee: number(rule?.codFee, 'رسوم الدفع عند الاستلام') || 0,
      returnFee: number(rule?.returnFee, 'رسوم المرتجع') || 0,
      extraKgRate: number(rule?.extraKgRate, 'سعر الكيلو الإضافي') || 0,
      baseWeight: Math.max(0.01, number(rule?.baseWeight, 'الوزن الأساسي', true) ?? 1),
      freeShippingThreshold: number(rule?.freeShippingThreshold, 'حد الشحن المجاني') || 0,
      etaMin,
      etaMax,
      etaUnit: rule?.etaUnit === 'days' ? 'days' : 'hours',
      enabled: rule?.enabled !== false,
    }
    if (normalized.enabled && normalizedRules.some((candidate) => candidate.enabled !== false && coverageOverlaps(candidate, normalized))) throw new HttpsError('invalid-argument', 'قواعد المناطق النشطة لا يمكن أن تتداخل')
    normalizedRules.push(normalized)
  }
  return normalizedRules
}

function normalizeProviderServices(input: any) {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  return input.slice(0, 50).map((service: any) => {
    const code = String(service?.code || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    const serviceName = String(service?.name || '').trim()
    if (!code || !serviceName) throw new HttpsError('invalid-argument', 'كل خدمة شحن تحتاج مفتاحاً واسماً')
    if (seen.has(code)) throw new HttpsError('invalid-argument', 'مفاتيح خدمات الشحن يجب أن تكون فريدة')
    seen.add(code)
    const min = Math.max(0, Number(service?.estimatedMinHours || 0))
    const max = Math.max(0, Number(service?.estimatedMaxHours || 0))
    if (max > 0 && max < min) throw new HttpsError('invalid-argument', 'مدة الخدمة غير صالحة')
    const number = (value: any, label: string) => { const parsed = Number(value || 0); if (!Number.isFinite(parsed) || parsed < 0) throw new HttpsError('invalid-argument', `قيمة ${label} غير صالحة`); return parsed }
    return {
      code: code.slice(0, 80), name: serviceName.slice(0, 120), enabled: service?.enabled !== false,
      serviceType: String(service?.serviceType || 'custom').slice(0, 30),
      estimatedMinHours: min, estimatedMaxHours: max,
      supportsCOD: service?.supportsCOD === true, supportsReturns: service?.supportsReturns === true,
      supportsPickup: service?.supportsPickup === true,
      supportedZones: Array.isArray(service?.supportedZones) ? service.supportedZones.map(String).slice(0, 100) : [],
      rateMode: SHIPPING_RATE_MODES.includes(service?.rateMode) ? service.rateMode : (service?.zoneRules?.length ? 'zone' : 'fixed'),
      fixedRate: number(service?.fixedRate, 'السعر الثابت'), freeShippingThreshold: number(service?.freeShippingThreshold, 'حد الشحن المجاني'),
      baseWeight: Math.max(0.01, number(service?.baseWeight, 'الوزن الأساسي') || 1), extraKgRate: number(service?.extraKgRate, 'سعر الكيلو الإضافي'),
      zoneRules: normalizeZoneRules(service?.zoneRules),
    }
  })
}

/**
 * A provider may only advertise webhooks when its server-side adapter can
 * both parse the provider payload and authenticate it. A UI flag alone is
 * never enough: publishing a callback URL without those two guarantees
 * creates a misleading and unsafe integration surface.
 */
function hasVerifiedWebhookContract(slug: unknown, integrationType: unknown): boolean {
  const adapter = getShippingAdapter(String(slug || ''), String(integrationType || 'manual'))
  return Boolean(adapter?.parseWebhook && adapter?.verifyWebhookSignature)
}

function safeShippingProvider(id: string, data: any) {
  const services = Array.isArray(data?.services) ? data.services.slice(0, 50).map((service: any) => ({
    code: String(service?.code || '').slice(0, 80),
    name: String(service?.name || '').slice(0, 120),
    enabled: service?.enabled !== false,
    serviceType: String(service?.serviceType || 'custom').slice(0, 30),
    estimatedMinHours: Number(service?.estimatedMinHours || 0) || null,
    estimatedMaxHours: Number(service?.estimatedMaxHours || 0) || null,
    supportsCOD: service?.supportsCOD === true,
    supportsReturns: service?.supportsReturns === true,
    supportsPickup: service?.supportsPickup === true,
    supportedZones: Array.isArray(service?.supportedZones) ? service.supportedZones.map(String).slice(0, 100) : [],
    rateMode: ['api', 'fixed', 'zone', 'weight', 'hybrid'].includes(service?.rateMode) ? service.rateMode : 'fixed',
    fixedRate: Math.max(0, Number(service?.fixedRate || 0)),
    freeShippingThreshold: Math.max(0, Number(service?.freeShippingThreshold || 0)),
    baseWeight: Math.max(0.01, Number(service?.baseWeight || 1)),
    extraKgRate: Math.max(0, Number(service?.extraKgRate || 0)),
    zoneRules: normalizeZoneRules(service?.zoneRules),
  })) : []
  return {
    id,
    name: String(data?.name || ''),
    slug: String(data?.slug || ''),
    logoUrl: data?.logoUrl || null,
    description: String(data?.description || ''),
    status: SHIPPING_PROVIDER_STATUSES.includes(data?.status) ? data.status : 'draft',
    integrationType: SHIPPING_INTEGRATION_TYPES.includes(data?.integrationType) ? data.integrationType : 'manual',
    credentialMode: SHIPPING_CREDENTIAL_MODES.includes(data?.credentialMode) ? data.credentialMode : 'platform',
    supportsCOD: data?.supportsCOD === true,
    supportsReturns: data?.supportsReturns === true,
    supportsTracking: data?.supportsTracking === true,
    supportsWebhooks: data?.supportsWebhooks === true && hasVerifiedWebhookContract(data?.slug, data?.integrationType),
    supportsPickup: data?.supportsPickup === true,
    supportedCountries: Array.isArray(data?.supportedCountries) ? data.supportedCountries.slice(0, 100) : [],
    defaultServiceCodes: Array.isArray(data?.defaultServiceCodes) ? data.defaultServiceCodes.slice(0, 100) : [],
    services,
    allowMerchantRateOverride: data?.allowMerchantRateOverride === true,
    adapterConfigured: Boolean(getShippingAdapter(data?.slug, data?.integrationType)),
    lastTestedAt: data?.lastTestedAt || null,
  }
}

function normalizeShippingProviderPayload(input: any) {
  const name = String(input?.name || '').trim()
  const slug = String(input?.slug || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (!name || name.length > 120) throw new HttpsError('invalid-argument', 'اسم شركة الشحن مطلوب وبحد أقصى 120 حرفاً')
  if (!slug || slug.length > 80) throw new HttpsError('invalid-argument', 'مفتاح شركة الشحن غير صالح')
  const status = SHIPPING_PROVIDER_STATUSES.includes(input?.status) ? input.status : 'draft'
  const integrationType = SHIPPING_INTEGRATION_TYPES.includes(input?.integrationType) ? input.integrationType : 'manual'
  const credentialMode = SHIPPING_CREDENTIAL_MODES.includes(input?.credentialMode) ? input.credentialMode : 'platform'
  if (['bosta', 'wasla'].includes(slug) && (integrationType !== 'api' || credentialMode !== 'merchant')) {
    throw new HttpsError('invalid-argument', `${slug === 'wasla' ? 'Wasla' : 'Bosta'} must use API integration with merchant-owned credentials`)
  }
  const services = normalizeProviderServices(input?.services)
  return {
    name,
    slug,
    logoUrl: input?.logoUrl ? String(input.logoUrl).slice(0, 2000) : null,
    description: String(input?.description || '').slice(0, 1000),
    status,
    integrationType,
    credentialMode,
    supportsCOD: input?.supportsCOD === true,
    supportsReturns: input?.supportsReturns === true,
    supportsTracking: input?.supportsTracking === true,
    // Keep advertised functionality aligned with the adapter contract. This
    // intentionally makes Wasla webhooks unavailable until a signed Wasla
    // webhook contract is implemented server-side.
    supportsWebhooks: input?.supportsWebhooks === true && hasVerifiedWebhookContract(slug, integrationType),
    supportsPickup: input?.supportsPickup === true,
    supportedCountries: Array.isArray(input?.supportedCountries) ? input.supportedCountries.map(String).slice(0, 100) : [],
    defaultServiceCodes: Array.isArray(input?.defaultServiceCodes) ? input.defaultServiceCodes.map(String).slice(0, 100) : [],
    services,
    allowMerchantRateOverride: input?.allowMerchantRateOverride === true,
  }
}

// ─────────────────────────────────────────────────────────────
// CRM helpers — phone normalization, stage/tags, timeline
// ─────────────────────────────────────────────────────────────
function normalizePhoneEG(input: unknown): string {
  if (!input) return ''
  let digits = String(input).replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0020')) digits = '0' + digits.slice(4)
  else if (digits.startsWith('20') && digits.length >= 12) {
    const without = digits.slice(2)
    if (without.length === 10 && without.startsWith('1')) digits = '0' + without
    else if (without.length === 11 && without.startsWith('01')) digits = without
    else digits = '0' + without
  }
  digits = digits.replace(/^0+/, '0')
  return digits
}

const CRM_STAGES = ['lead', 'new', 'active', 'repeat', 'vip', 'at_risk', 'lost'] as const
function normalizeCrmStage(v: unknown): string | null {
  if (!v) return null
  const low = String(v).toLowerCase().trim()
  if ((CRM_STAGES as readonly string[]).includes(low)) return low
  const legacy: Record<string, string> = { new: 'new', repeat: 'repeat', vip: 'vip', inactive: 'lost', 'جديد': 'new', 'متكرر': 'repeat', 'مكرر': 'repeat', 'مهمل': 'lost', 'نشط': 'active' }
  return legacy[String(v)] || legacy[low] || null
}

function sanitizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    const tag = String(raw || '').trim().slice(0, 30)
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
    if (out.length >= 20) break
  }
  return out
}

function crmStageLabel(stage: string | null | undefined): string {
  const map: Record<string, string> = { lead: 'عميل محتمل', new: 'عميل جديد', active: 'نشط', repeat: 'متكرر', vip: 'VIP', at_risk: 'معرض للخسارة', lost: 'مفقود' }
  return stage ? (map[String(stage)] || String(stage)) : ''
}

async function emitCustomerTimeline(tx: FirebaseFirestore.Transaction | FirebaseFirestore.Firestore, data: {
  storeId: string
  customerId: string
  type: string
  title: string
  body?: string
  orderId?: string | null
  orderNumber?: string | null
  shipmentId?: string | null
  followUpId?: string | null
  meta?: Record<string, unknown>
  createdBy?: string | null
}) {
  const ref = db.collection('customerTimeline').doc()
  const payload: Record<string, unknown> = {
    id: ref.id,
    storeId: data.storeId,
    customerId: data.customerId,
    type: data.type,
    title: data.title,
    body: data.body || null,
    orderId: data.orderId || null,
    orderNumber: data.orderNumber || null,
    shipmentId: data.shipmentId || null,
    followUpId: data.followUpId || null,
    meta: data.meta || null,
    createdBy: data.createdBy || null,
    createdAt: now(),
    updatedAt: now(),
  }
  if ((tx as FirebaseFirestore.Transaction).set) {
    ;(tx as FirebaseFirestore.Transaction).set(ref, payload)
  } else {
    await (tx as FirebaseFirestore.Firestore).collection('customerTimeline').doc(ref.id).set(payload)
  }
  return ref.id
}

async function logCustomerEvent(storeId: string, customerId: string, type: string, title: string, extra: Record<string, unknown> = {}) {
  try {
    await db.collection('customerTimeline').add({
      storeId,
      customerId,
      type,
      title,
      body: extra.body || null,
      orderId: extra.orderId || null,
      orderNumber: extra.orderNumber || null,
      shipmentId: extra.shipmentId || null,
      followUpId: extra.followUpId || null,
      meta: extra.meta || null,
      createdBy: extra.createdBy || null,
      createdAt: now(),
      updatedAt: now(),
    })
  } catch {}
}

function calcCustomerMetricsFromOrders(orders: any[]) {
  const totalOrders = orders.length
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED').length
  const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED').length
  const returnedOrders = orders.filter((o) => o.status === 'RETURNED').length
  const shippedOrders = orders.filter((o) => o.status === 'SHIPPED').length
  const totalRevenue = orders.filter((o) => o.status === 'DELIVERED').reduce((s: number, o: any) => s + (o.totalPrice || 0), 0)
  const avgOrderValue = deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0
  const sorted = [...orders].sort((a, b) => (toMillis(b.createdAt) ?? 0) - (toMillis(a.createdAt) ?? 0))
  const lastOrder = sorted[0] || null
  const lastOrderAt = lastOrder?.createdAt || null
  const lastOrderNumber = lastOrder?.orderNumber || null
  const lastOrderStatus = lastOrder?.status || null
  const daysSinceLastOrder = (() => {
    const m = toMillis(lastOrderAt)
    return m == null ? null : Math.floor((Date.now() - m) / 86400000)
  })()
  const returnRate = totalOrders > 0 ? returnedOrders / totalOrders : 0
  const cancellationRate = totalOrders > 0 ? cancelledOrders / totalOrders : 0
  // product breakdown
  const productMap = new Map<string, { productId: string; name: string; qty: number; revenue: number }>()
  for (const o of orders) {
    for (const it of o.items || []) {
      const key = it.productId
      const prev = productMap.get(key) || { productId: key, name: it.name || key, qty: 0, revenue: 0 }
      prev.qty += Number(it.quantity || 0)
      prev.revenue += Number(it.lineTotal ?? (it.price || 0) * (it.quantity || 0))
      productMap.set(key, prev)
    }
  }
  const products = [...productMap.values()].sort((a, b) => b.revenue - a.revenue)
  return {
    totalOrders, deliveredOrders, cancelledOrders, returnedOrders, shippedOrders,
    totalRevenue, avgOrderValue, lifetimeValue: totalRevenue,
    lastOrderAt, lastOrderNumber, lastOrderStatus, daysSinceLastOrder,
    returnRate, cancellationRate, repeatPurchaseRate: totalOrders > 1 ? 1 : 0,
    products: products.slice(0, 10), topProduct: products[0] || null,
  }
}

const _ALL_PERMISSIONS = [
  'products:view',
  'products:create',
  'products:edit',
  'products:delete',
  'orders:view',
  'orders:edit',
  'orders:status',
  'orders:cancel',
  'customers:view',
  'customers:create',
  'customers:edit',
  'customers:delete',
  'customers:export',
  'customers:notes',
  'customers:tags',
  'customers:followups',
  'crm:view',
  'crm:manage',
  'crm:followups',
  'crm:export',
  'crm:analytics',
  'inventory:view',
  'inventory:adjust',
  'sales_links:view',
  'sales_links:create',
  'sales_links:analytics',
  'reports:view',
  'team:view',
  'team:invite',
  'team:manage_roles',
  'team:delete',
  'settings:view',
  'settings:edit',
  'coupons:manage',
  'landing:manage',
] as const

async function assertPlatformAdmin(request: CallableRequest) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const role = await getUserRole(request.auth.uid)
  if (role !== 'superAdmin') throw new HttpsError('permission-denied', 'صلاحيات غير كافية')
}

const DEFAULT_ENTERPRISE_WHATSAPP_MESSAGE = 'مرحبًا، أرغب في الحصول على عرض سعر لحلول Enterprise / White Label من Matjari.'
const WHATSAPP_AUTOMATION_EVENTS = ['order.created', 'shipment.created', 'shipment.delivered', 'shipment.returned'] as const
const DEFAULT_WHATSAPP_TEMPLATES: Record<typeof WHATSAPP_AUTOMATION_EVENTS[number], string> = {
  'order.created': 'أهلاً {{customer_name}} 👋\nتم استلام طلبك رقم {{order_number}} بنجاح. هنبدأ نجهزه فوراً.',
  'shipment.created': 'طلبك رقم {{order_number}} خرج للشحن 🚚\nرقم التتبع: {{tracking_number}}\nتقدر تتابعه من: {{tracking_url}}',
  'shipment.delivered': 'طلبك رقم {{order_number}} تم تسليمه ✅\nنتمنى تجربتك تكون ممتازة يا {{customer_name}}.',
  'shipment.returned': 'تم استلام مرتجع الطلب رقم {{order_number}}. شكرًا لتعاملك معانا يا {{customer_name}}.',
}

type WhatsAppAutomationEvent = typeof WHATSAPP_AUTOMATION_EVENTS[number]
type MetaWhatsAppTemplate = { name: string; language: string }

const DEFAULT_META_WHATSAPP_TEMPLATES: Record<WhatsAppAutomationEvent, MetaWhatsAppTemplate> = {
  'order.created': { name: '', language: 'ar' },
  'shipment.created': { name: '', language: 'ar' },
  'shipment.delivered': { name: '', language: 'ar' },
  'shipment.returned': { name: '', language: 'ar' },
}

// Meta accepts only a template name, not arbitrary merchant text. Keeping the
// validation narrow prevents a malformed setting from ever reaching its API.
function normalizeMetaWhatsAppTemplate(value: unknown): MetaWhatsAppTemplate {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const name = String(raw.name || '').trim().toLowerCase()
  const language = String(raw.language || 'ar').trim()
  return {
    name: /^[a-z0-9_]{1,512}$/.test(name) ? name : '',
    language: /^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language) ? language : 'ar',
  }
}

function metaTemplateParameters(eventType: WhatsAppAutomationEvent, values: Record<string, string>) {
  const text = (value: string) => ({ type: 'text', text: String(value || '—').slice(0, 1024) })
  switch (eventType) {
    case 'shipment.created':
      return [text(values.order_number), text(values.tracking_number), text(values.tracking_url)]
    case 'order.created':
    case 'shipment.delivered':
    case 'shipment.returned':
      return [text(values.customer_name), text(values.order_number)]
  }
}

function safeWhatsAppAutomationConfig(data: Record<string, any> = {}) {
  const raw = data.whatsappAutomation && typeof data.whatsappAutomation === 'object' ? data.whatsappAutomation : data
  const senderNumber = normalizeEnterpriseWhatsAppNumber(raw.senderNumber)
  const events = Array.isArray(raw.events)
    ? raw.events.filter((event: unknown): event is typeof WHATSAPP_AUTOMATION_EVENTS[number] => WHATSAPP_AUTOMATION_EVENTS.includes(String(event) as typeof WHATSAPP_AUTOMATION_EVENTS[number]))
    : [...WHATSAPP_AUTOMATION_EVENTS]
  const templates = Object.fromEntries(WHATSAPP_AUTOMATION_EVENTS.map((event) => [event, typeof raw.templates?.[event] === 'string' && raw.templates[event].trim() ? raw.templates[event].trim().slice(0, 1200) : DEFAULT_WHATSAPP_TEMPLATES[event]]))
  const metaTemplates = Object.fromEntries(WHATSAPP_AUTOMATION_EVENTS.map((event) => [event, normalizeMetaWhatsAppTemplate(raw.metaTemplates?.[event])])) as Record<WhatsAppAutomationEvent, MetaWhatsAppTemplate>
  // A phone number is not a WhatsApp Business connection.  Keep this state
  // explicit until the server has a verified Meta connection; this prevents
  // merchants from assuming messages are being sent merely because a number
  // was saved in the settings page.
  const status = data.metaConnectionStatus === 'CONNECTED' && data.metaConnectionVerifiedAt
    ? 'CONNECTED'
    : senderNumber ? 'AWAITING_META_CONNECTION' : 'AWAITING_NUMBER'
  return { senderNumber, events: events.length ? events : [...WHATSAPP_AUTOMATION_EVENTS], templates, metaTemplates, status, metaPhoneNumberIdMasked: String(data.metaPhoneNumberIdMasked || '') }
}

function resolveWhatsAppTemplate(template: string, values: Record<string, string>) {
  return String(template || '').replace(/\{\{(customer_name|order_number|tracking_number|tracking_url)\}\}/g, (_match, key) => values[key] || '')
}

function maskPhone(value: unknown) {
  const phone = String(value || '').replace(/\D/g, '')
  return phone.length >= 4 ? `${'*'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}` : ''
}

/** Creates an auditable record for every enabled event. It never claims that
 * a message was delivered before a WhatsApp Business / Meta connection exists. */
async function queueWhatsAppAutomationEvent(eventId: string, data: Record<string, any>) {
  if (!WHATSAPP_AUTOMATION_EVENTS.includes(String(data.eventType) as typeof WHATSAPP_AUTOMATION_EVENTS[number])) return 'NOT_APPLICABLE'
  const storeId = String(data.storeId || '')
  const orderId = String(data.payload?.orderId || (data.entityType === 'order' ? data.entityId : '') || '')
  if (!storeId || !orderId) return 'MISSING_ORDER'
  const [settingsSnap, orderSnap, storeSnap] = await Promise.all([
    db.doc(`storeWhatsAppAutomation/${storeId}`).get(),
    db.doc(`orders/${orderId}`).get(),
    db.doc(`stores/${storeId}`).get(),
  ])
  if (!orderSnap.exists) return 'MISSING_ORDER'
  const config = safeWhatsAppAutomationConfig(settingsSnap.exists ? settingsSnap.data() || {} : {})
  const eventType = String(data.eventType) as typeof WHATSAPP_AUTOMATION_EVENTS[number]
  if (!config.events.includes(eventType)) return 'EVENT_DISABLED'
  const order = orderSnap.data() || {}
  const payload = data.payload || {}
  const orderNumber = String(order.orderNumber || orderId)
  const trackingNumber = String(payload.trackingNumber || order.trackingNumber || '')
  const storeSlug = String(storeSnap.data()?.slug || '')
  const values = {
    customer_name: String(order.customer?.name || order.customerName || 'عميلنا'),
    order_number: orderNumber,
    tracking_number: trackingNumber,
    tracking_url: trackingNumber && storeSlug ? `https://mtjari.shop/store/${storeSlug}/track` : '',
  }
  const message = resolveWhatsAppTemplate(config.templates[eventType], values).trim()
  const recipientPhone = normalizeEnterpriseWhatsAppNumber(order.customer?.phone || order.customerPhone)
  const deliveryRef = db.doc(`whatsappDeliveries/${eventId}`)
  // Claim this event before calling Meta. Cloud events are at-least-once, so
  // this prevents a retry from sending the same business notification twice.
  const claimed = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(deliveryRef)
    if (existing.exists) return false
    transaction.create(deliveryRef, {
      id: eventId, eventId, storeId, orderId, eventType, orderNumber,
      recipientPhoneMasked: maskPhone(recipientPhone), message,
      deliveryStatus: 'SENDING', reason: null, createdAt: now(), updatedAt: now(),
    })
    return true
  })
  if (!claimed) return 'ALREADY_RECORDED'

  const metaTemplate = config.metaTemplates[eventType]
  if (config.status !== 'CONNECTED') {
    await deliveryRef.set({ deliveryStatus: 'NOT_SENT_NOT_CONNECTED', reason: 'لم يكتمل ربط WhatsApp Business وMeta بعد', updatedAt: now() }, { merge: true })
    return 'NOT_SENT_NOT_CONNECTED'
  }
  if (!recipientPhone) {
    await deliveryRef.set({ deliveryStatus: 'FAILED', reason: 'رقم هاتف العميل غير صالح للإرسال عبر واتساب', updatedAt: now() }, { merge: true })
    return 'FAILED'
  }
  if (!metaTemplate.name) {
    await deliveryRef.set({ deliveryStatus: 'AWAITING_APPROVED_TEMPLATE', reason: 'أضف اسم قالب Meta المعتمد لهذا الحدث قبل تشغيل الإرسال التلقائي', updatedAt: now() }, { merge: true })
    return 'AWAITING_APPROVED_TEMPLATE'
  }
  let vault: Awaited<ReturnType<typeof loadIntegrationCredentials>>
  try { vault = await loadIntegrationCredentials(db, storeId, 'whatsapp', 'meta') }
  catch { vault = null }
  if (!vault) {
    await deliveryRef.set({ deliveryStatus: 'NOT_SENT_NOT_CONNECTED', reason: 'بيانات ربط Meta غير متاحة؛ احفظها واختبر الاتصال من الإعدادات', updatedAt: now() }, { merge: true })
    return 'NOT_SENT_NOT_CONNECTED'
  }
  const phoneNumberId = String(vault.credentials.phoneNumberId || '')
  const accessToken = String(vault.credentials.accessToken || '')
  try {
    const response = await fetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: recipientPhone, type: 'template',
        template: { name: metaTemplate.name, language: { code: metaTemplate.language }, components: [{ type: 'body', parameters: metaTemplateParameters(eventType, values) }] },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const body = await response.json().catch(() => ({})) as Record<string, any>
    if (!response.ok || !body.messages?.[0]?.id) throw new Error(String(body?.error?.message || `Meta returned ${response.status}`))
    await deliveryRef.set({ deliveryStatus: 'SENT', reason: null, metaMessageId: String(body.messages[0].id), metaTemplateName: metaTemplate.name, updatedAt: now() }, { merge: true })
    return 'SENT'
  } catch (error) {
    const reason = sanitizeSensitiveText(error instanceof Error ? error.message : 'تعذر إرسال الرسالة عبر Meta', [accessToken]).slice(0, 500)
    await deliveryRef.set({ deliveryStatus: 'FAILED', reason, metaTemplateName: metaTemplate.name, updatedAt: now() }, { merge: true })
    return 'FAILED'
  }
}

function normalizeEnterpriseWhatsAppNumber(value: unknown): string {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 ? digits : ''
}

function safeEnterpriseWhatsAppConfig(data: Record<string, any> = {}) {
  const number = normalizeEnterpriseWhatsAppNumber(data.enterpriseWhatsAppNumber)
  const enabled = data.enterpriseWhatsAppEnabled === true && Boolean(number)
  return {
    enterpriseWhatsAppNumber: enabled ? number : '',
    enterpriseWhatsAppEnabled: enabled,
    enterpriseWhatsAppMessage: typeof data.enterpriseWhatsAppMessage === 'string' && data.enterpriseWhatsAppMessage.trim()
      ? data.enterpriseWhatsAppMessage.trim().slice(0, 500)
      : DEFAULT_ENTERPRISE_WHATSAPP_MESSAGE,
  }
}

async function deleteCollectionDocs(collectionName: string, storeId: string): Promise<number> {
  const snap = await db.collection(collectionName).where('storeId', '==', storeId).get()
  if (snap.empty) return 0
  let deleted = 0
  const chunks = [...snap.docs]
  while (chunks.length) {
    const batch = db.batch()
    const part = chunks.splice(0, 450)
    for (const doc of part) {
      batch.delete(doc.ref)
      deleted++
    }
    await batch.commit()
  }
  return deleted
}

async function deleteStoreSubcollectionDocs(storeId: string, subcollection: string): Promise<number> {
  const snap = await db.collection(`stores/${storeId}/${subcollection}`).get()
  if (snap.empty) return 0
  let deleted = 0
  const chunks = [...snap.docs]
  while (chunks.length) {
    const batch = db.batch()
    const part = chunks.splice(0, 450)
    for (const doc of part) {
      batch.delete(doc.ref)
      deleted++
    }
    await batch.commit()
  }
  return deleted
}

// RBAC gate for store-scoped operations.
// - superAdmin: platform-wide access
// - merchant (owner of storeId): full access
// - staff (member of storeId): access only when they hold `perm` (when provided)
async function assertStoreAccess(request: CallableRequest, storeId: string, perm?: string | string[]) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const userSnap = await db.doc(`users/${request.auth.uid}`).get()
  const user = userSnap.data()
  if (!user) throw new HttpsError('permission-denied', 'الحساب غير موجود')
  if (user.role === 'superAdmin') return
  // A merchant application is not an operational tenant until a platform
  // administrator approves it.  Keep this check server-side so hiding the
  // dashboard is never the security boundary.
  if (user.role === 'merchant' && (user.active === false || (user.merchantStatus && user.merchantStatus !== 'active'))) {
    throw new HttpsError('permission-denied', 'الحساب بانتظار موافقة إدارة المنصة')
  }
  const storeSnap = await db.doc(`stores/${storeId}`).get()
  const ownerId = storeSnap.exists ? storeSnap.data()?.ownerId : null
  if (ownerId && ownerId !== request.auth.uid) {
    const ownerSnap = await db.doc(`users/${ownerId}`).get()
    const owner = ownerSnap.data()
    if (owner?.role === 'merchant' && (owner.active === false || (owner.merchantStatus && owner.merchantStatus !== 'active'))) {
      throw new HttpsError('permission-denied', 'المتجر بانتظار موافقة إدارة المنصة')
    }
  }
  if (!(user.storeIds || []).includes(storeId)) {
    throw new HttpsError('permission-denied', 'لا تملك هذا المتجر')
  }
  if (user.role === 'merchant') return
  if (user.role === 'staff') {
    if (perm) {
      const required = Array.isArray(perm) ? perm : [perm]
      const ok = required.some((p) => (user.permissions || []).includes(p))
      if (!ok) throw new HttpsError('permission-denied', 'صلاحيات غير كافية لهذه العملية')
    }
    return
  }
  throw new HttpsError('permission-denied', 'صلاحيات غير كافية')
}

const ORDER_TRANSITIONS: Record<string, string[]> = {
  NEW: ['CONTACTED', 'PROCESSING', 'CANCELLED'],
  CONTACTED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
}

function assertOrderTransition(from: string, to: string) {
  if (from === to) return
  if (!(ORDER_TRANSITIONS[from] || []).includes(to)) {
    throw new HttpsError('failed-precondition', `لا يمكن نقل الطلب من ${from} إلى ${to}`)
  }
}

async function bumpAnalytics(storeId: string, opts: { totalPrice?: number; status?: string; countOrder?: boolean; revenueDelta?: number }) {
  const d = new Date()
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const ref = db.doc(`analytics/${storeId}_${key}`)
  const countOrder = opts.countOrder ?? false
  const revenueDelta = opts.revenueDelta ?? (opts.status === 'DELIVERED' ? (opts.totalPrice || 0) : 0)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const prev = (snap.exists ? snap.data() : {}) || {}
    const byStatus = { ...(prev.byStatus || {}) }
    if (opts.status) byStatus[opts.status] = (byStatus[opts.status] || 0) + 1
    tx.set(ref, {
      storeId,
      date: key,
      orders: (prev.orders || 0) + (countOrder ? 1 : 0),
      revenue: FieldValue.increment(revenueDelta),
      newCustomers: prev.newCustomers || 0,
      byStatus,
      updatedAt: now(),
    }, { merge: true })
  })
}

async function auditLog(storeId: string | null, userId: string, action: string, resource: string, resourceId: string, extra?: Record<string, any>) {
  await db.collection('auditLogs').add({
    storeId,
    userId,
    action,
    resource,
    resourceId,
    ...extra,
    createdAt: now(),
  })
}

// ─────────────────────────────────────────────────────────────
// Subscription lifecycle helpers
// ─────────────────────────────────────────────────────────────

const DAY_MS = 86400000
const PERIOD_DAYS = 30
const YEAR_DAYS = 365
const FREE_TRIAL_DAYS = 30
const PUBLIC_PAID_PLAN_IDS = new Set(['plan-basic', 'plan-starter', 'plan-growth', 'plan-pro'])
const PLAN_FEATURE_KEYS = [
  'quantityPricing', 'variantInventory', 'coupons', 'analytics', 'whatsappAutomation',
]

// Paid plans always need a real trial window. A value of zero is reserved for
// Free/lifetime access; otherwise registration would create an immediately
// expired paid trial. This keeps the SuperAdmin plan setting authoritative.
function paidTrialDays(plan: any): number {
  const configured = Number(plan?.trialDays)
  if (!Number.isFinite(configured)) return 3
  return Math.min(90, Math.max(1, Math.floor(configured)))
}

// Mirrors src/shared/services/subscription.ts (client). Functions is a
// separate package, so status resolution is duplicated here on purpose and
// must stay in sync with the client helper.
function tsMs(t?: { seconds?: number } | null): number | null {
  if (!t || typeof t.seconds !== 'number') return null
  return t.seconds * 1000
}

function resolveSubscriptionStatus(sub: any, nowMs = Date.now()): string {
  // A lifetime purchase has no expiry window.  The flag is only written by
  // the transactional purchase approval path; never trust a browser value.
  if (sub?.billingModel === 'one_time' && sub?.ownershipType === 'lifetime' && sub?.lifetimeAccess === true) return 'active'
  const explicit = sub?.status
  if (explicit === 'cancelled' || explicit === 'suspended') return explicit
  if (explicit === 'trialing') {
    const ends = tsMs(sub?.trialEndsAt)
    if (ends != null && nowMs >= ends) return 'expired'
    return 'trialing'
  }
  if (explicit === 'active') {
    const ends = tsMs(sub?.currentPeriodEnd) ?? tsMs(sub?.expiresAt)
    if (ends != null && nowMs >= ends) return 'expired'
    return 'active'
  }
  return explicit || 'pending'
}

async function latestSubscriptionForStore(storeId: string): Promise<{ id: string; data: any } | null> {
  // Store.activeSubscriptionId is the single canonical effective-subscription pointer.
  // Keep the query fallback only for legacy/local records; callers should converge the
  // pointer whenever an activation succeeds.
  const storeSnap = await db.doc(`stores/${storeId}`).get()
  const pointer = storeSnap.exists ? storeSnap.data()?.activeSubscriptionId : null
  if (pointer) {
    const pointed = await db.doc(`subscriptions/${pointer}`).get()
    if (pointed.exists && pointed.data()?.storeId === storeId) return { id: pointed.id, data: pointed.data() }
  }
  const snap = await db.collection('subscriptions').where('storeId', '==', storeId).orderBy('createdAt', 'desc').limit(1).get()
  if (snap.empty) return null
  return { id: snap.docs[0].id, data: snap.docs[0].data() }
}

// Lazily persist an expiry flip (deduped) with a notification + audit trail.
// No background jobs on the Spark plan, so expiry is enforced on access.
async function expireSubscriptionLazily(storeId: string, subId: string, sub: any, userId?: string | null) {
  if (sub?.status === 'expired') return
  await db.doc(`subscriptions/${subId}`).update({ status: 'expired', trialStatus: 'expired', trialConsumed: true, updatedAt: now() })
  await db.collection('notifications').add({
    storeId,
    userId: null,
    title: 'انتهت تجربتك المجانية',
    body: 'بيانات متجرك محفوظة بالكامل. فعّل باقتك لاستكمال البيع.',
    type: 'billing',
    read: false,
    createdAt: now(),
    createdBy: 'system',
  }).catch(() => {})
  await auditLog(storeId, userId || 'system', 'subscription_expired', 'subscriptions', subId, { storeId }).catch(() => {})
}

// Returns the subscription that grants store operations (trial or paid active),
// resolving + lazily expiring when the window has passed. Null when the store
// has no granting subscription. Never trusts a client-supplied status.
async function grantForStore(storeId: string, userId?: string | null): Promise<{ sub: any; subId: string; plan: any } | null> {
  const storeOwnerSnap = await db.doc(`stores/${storeId}`).get()
  const ownerId = storeOwnerSnap.exists ? storeOwnerSnap.data()?.ownerId : null
  if (ownerId) {
    const ownerSnap = await db.doc(`users/${ownerId}`).get()
    const owner = ownerSnap.data()
    if (owner?.role === 'merchant' && (owner.active === false || (owner.merchantStatus && owner.merchantStatus !== 'active'))) return null
  }
  const entry = await latestSubscriptionForStore(storeId)
  if (!entry) return null
  const status = resolveSubscriptionStatus(entry.data)
  const isLifetime = entry.data?.billingModel === 'one_time' && entry.data?.ownershipType === 'lifetime' && entry.data?.lifetimeAccess === true
  if (status === 'trialing' || status === 'active') {
    const planSnap = await db.doc(`plans/${entry.data.planId}`).get()
    if (!planSnap.exists) return null
    return { sub: entry.data, subId: entry.id, plan: effectivePlanForSubscription(entry.data, planSnap.data()) }
  }
  if (!isLifetime && status === 'expired' && entry.data.status !== 'expired') {
    await expireSubscriptionLazily(storeId, entry.id, entry.data, userId).catch(() => {})
  }
  return null
}

// Structured feature gate (mirrors src/shared/services/subscription.ts).
// A plan grants a feature when it explicitly sets the boolean flag true, or
// (legacy plans) when the free-text features list contains the label.
function canUseFeature(plan: any, feature: string): boolean {
  if (!plan) return false
  const flag = plan[feature]
  if (typeof flag === 'boolean') return flag
  const labels: Record<string, string> = {
    quantityPricing: 'تسعير بالكمية',
    variantInventory: 'مخزون حسب المقاس/اللون',
    coupons: 'كوبونات خصم',
    analytics: 'تحليلات أساسية',
    whatsappAutomation: 'أتمتة واتساب',
  }
  const label = labels[feature] || feature
  return Array.isArray(plan.features) && plan.features.some((f: any) => f === feature || f === label)
}

// Whether a plan grants a resource without a numeric ceiling.
// New plans express this with an explicit boolean (unlimitedProducts /
// unlimitedSalesLinks). An explicit `false` ALWAYS wins, so a brand-new plan
// with a zero limit is treated as "0 allowed" (hard block), not unlimited.
// Legacy plans that omit the boolean keep the historic 0-or-null == unlimited
// semantics so already-seeded PRO stores continue to work during migration.
function isResourceUnlimited(plan: any, field: 'unlimitedProducts' | 'unlimitedSalesLinks'): boolean {
  if (!plan) return false
  if (plan[field] === true) return true
  if (plan[field] === false) return false
  const limitField = field === 'unlimitedProducts' ? 'productLimit' : 'salesLinksLimit'
  return Number(plan[limitField] || 0) === 0
}

// Resolve a plan's numeric quota for a resource. Returns `null` when the plan
// grants the resource without a ceiling (explicit unlimited flag, OR — for
// legacy plans with the boolean absent — a zero/missing limit). When it returns
// a number it is an authoritative cap (0 == no resource allowed, hard block),
// which is the new-plan semantics; legacy 0 stays unlimited via the helper above.
function resolvedLimit(plan: any, limitField: 'productLimit' | 'salesLinksLimit', unlimitedField: 'unlimitedProducts' | 'unlimitedSalesLinks'): number | null {
  if (isResourceUnlimited(plan, unlimitedField)) return null
  return Number(plan[limitField] || 0)
}

// A paid period owns the limits/features/prices captured at activation. Live
// catalog edits are for new activations and must not retroactively change an
// existing merchant's entitlements.
function effectivePlanForSubscription(sub: any, livePlan: any): any {
  if (!livePlan) return livePlan
  const purchase = sub?.purchaseSnapshot && typeof sub.purchaseSnapshot === 'object' ? sub.purchaseSnapshot : null
  const limits = sub?.limitsSnapshot && typeof sub.limitsSnapshot === 'object' ? sub.limitsSnapshot : null
  const featureFlags = sub?.featureFlagsSnapshot && typeof sub.featureFlagsSnapshot === 'object' ? sub.featureFlagsSnapshot : null
  const features = Array.isArray(sub?.featuresSnapshot) ? sub.featuresSnapshot : null
  if (!limits && !featureFlags && !features && !purchase && sub?.normalPriceSnapshot == null) return livePlan
  return {
    ...livePlan,
    ...(purchase || {}),
    ...(limits || {}),
    ...(featureFlags || {}),
    ...(features ? { features } : {}),
    ...(sub?.normalPriceSnapshot != null ? { priceMonthly: Number(sub.normalPriceSnapshot) } : {}),
    ...(sub?.yearlyPriceSnapshot != null ? { priceYearly: Number(sub.yearlyPriceSnapshot) } : {}),
  }
}

/** Canonical quota projection consumed by every merchant usage surface.
 * The owner occupies one team seat; all other counters are server-derived from
 * the same store and subscription snapshot used by entitlement checks. */
async function merchantResourceUsage(storeId: string, sub: any, plan: any, store: any) {
  const [products, team, landingPages, salesLinks] = await Promise.all([
    countWhere(storeId, 'products'),
    countWhere(storeId, 'team'),
    countWhere(storeId, 'landingPages'),
    countWhere(storeId, 'storeLinks'),
  ])
  const metric = (used: number, limit: number | null) => ({
    used,
    limit: limit == null ? 0 : Math.max(0, limit),
    remaining: limit == null ? null : Math.max(0, limit - used),
    percent: limit == null || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100)),
  })
  const productLimit = resolvedLimit(plan, 'productLimit', 'unlimitedProducts')
  const salesLinkLimit = resolvedLimit(plan, 'salesLinksLimit', 'unlimitedSalesLinks')
  const storageLimit = Number(plan?.storageLimit || 0) > 0 ? Number(plan.storageLimit || 0) * 1024 * 1024 : null
  return {
    orders: metric(Number(sub?.ordersUsed || 0), Number(plan?.orderLimitPerMonth || 0) > 0 ? Number(plan.orderLimitPerMonth) : null),
    products: metric(products, productLimit),
    team: metric(1 + team, Number(plan?.staffLimit || 0) > 0 ? Number(plan.staffLimit) : 1),
    storage: metric(Number(store?.storageUsed || 0), storageLimit),
    landingPages: metric(landingPages, Number(plan?.landingPagesLimit || 0) > 0 ? Number(plan.landingPagesLimit) : 0),
    salesLinks: metric(salesLinks, salesLinkLimit),
  }
}

async function createBillingNotification(storeId: string, userId: string | null, title: string, body: string) {
  await db.collection('notifications').add({
    storeId,
    userId,
    title,
    body,
    type: 'billing',
    read: false,
    createdAt: now(),
    createdBy: 'system',
  })
}

interface BillingSnapshotInput {
  type: 'activation' | 'plan_change' | 'renewal' | 'manual'
  planId: string
  planName?: string
  priceMonthly?: number
  priceYearly?: number
  orderLimitPerMonth?: number
  productLimit?: number
  storageLimitMB?: number
  currency?: string
  by?: string | null
  note?: string
}

/**
 * Appends an immutable, editable-history billing snapshot for the store. These
 * records capture the plan + price + limits that were IN EFFECT at a given
 * moment (activation, plan change, manual edit), giving merchants a transparent
 * audit trail of what they were charged for. Non-blocking.
 */
async function recordBillingSnapshot(storeId: string, snap: BillingSnapshotInput) {
  try {
    await db.collection(`stores/${storeId}/billingSnapshots`).add({
      storeId,
      ...snap,
      at: now(),
      createdAt: now(),
    })
  } catch {
    /* billing history must never break the primary mutation */
  }
}

// Activates a subscription into a paid period. Shared by the legacy
// approveSubscription path and the new manual-payment approval path so the
// activation logic (price snapshots, period windows, counters) never forks.
async function activateSubscription(
  subId: string,
  sub: any,
  actorUid: string,
  opts: { periodNumber?: number; reference?: string; launchUsed?: boolean; paymentRequestId?: string } = {},
): Promise<{ store: any; user: any; normalPriceSnapshot: number; launchPriceSnapshot: number; periodNumber: number }> {
  const storeSnap = await db.doc(`stores/${sub.storeId}`).get()
  if (!storeSnap.exists) throw new HttpsError('not-found', 'المتجر غير موجود')
  const store = storeSnap.data()!

  const userSnap = await db.doc(`users/${store.ownerId}`).get()
  const user = userSnap.exists ? userSnap.data()! : null

  let plan: any = null
  try {
    const planSnap = await db.doc(`plans/${sub.planId}`).get()
    plan = planSnap.exists ? planSnap.data() : null
  } catch {
    plan = null
  }

  const normalPriceSnapshot = Number(sub.normalPriceSnapshot ?? plan?.priceMonthly ?? 0)
  const launchPriceSnapshot = Number(sub.launchPriceSnapshot ?? (plan?.launchEnabled && Number(plan.launchPrice) > 0 ? plan.launchPrice : normalPriceSnapshot) ?? normalPriceSnapshot)
  const yearlyPriceSnapshot = Number(sub.yearlyPriceSnapshot ?? plan?.priceYearly ?? 0)

  if (user) {
    await auth.updateUser(store.ownerId, { disabled: false }).catch(() => {})
    await db.doc(`users/${store.ownerId}`).update({ active: true }).catch(() => {})
  }

  const nowMs = Date.now()
  const periodNumber = opts.periodNumber != null ? opts.periodNumber : Number(sub.periodNumber || 0) + 1
  // Yearly subscriptions renew every 365 days; monthly every 30. The period window
  // and price snapshot used for THIS period are taken from the subscription doc
  // (never recomputed from the live plan, so historical billing is stable).
  const periodDays = sub.billingCycle === 'yearly' ? YEAR_DAYS : PERIOD_DAYS

  await db.doc(`subscriptions/${subId}`).update({
    status: 'active',
    approvedBy: actorUid,
    adminEmail: user?.email || null,
    activatedAt: tsFromDate(new Date(nowMs)),
    currentPeriodStart: tsFromDate(new Date(nowMs)),
    currentPeriodEnd: tsFromDate(new Date(nowMs + periodDays * DAY_MS)),
    ordersUsed: 0,
    periodNumber,
    billingCycle: sub.billingCycle || 'monthly',
    normalPriceSnapshot,
    launchPriceSnapshot,
    yearlyPriceSnapshot,
    limitsSnapshot: {
      orderLimitPerMonth: Number(plan?.orderLimitPerMonth || 0),
      productLimit: Number(plan?.productLimit || 0),
      landingPagesLimit: Number(plan?.landingPagesLimit || 0),
      salesLinksLimit: Number(plan?.salesLinksLimit || 0),
      staffLimit: Number(plan?.staffLimit || 0),
      storageLimit: Number(plan?.storageLimit || 0),
      ...(typeof plan?.unlimitedProducts === 'boolean' ? { unlimitedProducts: plan.unlimitedProducts } : {}),
      ...(typeof plan?.unlimitedSalesLinks === 'boolean' ? { unlimitedSalesLinks: plan.unlimitedSalesLinks } : {}),
    },
    featuresSnapshot: Array.isArray(plan?.features) ? plan.features : [],
    featureFlagsSnapshot: {
    quantityPricing: plan?.quantityPricing === true,
    variantInventory: plan?.variantInventory === true,
    coupons: plan?.coupons === true,
    analytics: plan?.analytics !== false,
    whatsappAutomation: plan?.whatsappAutomation === true,
    },
    launchUsed: opts.launchUsed ?? (launchPriceSnapshot < normalPriceSnapshot && periodNumber <= 1),
    trialStartedAt: FieldValue.delete(),
    trialEndsAt: FieldValue.delete(),
    ...(opts.paymentRequestId ? { lastPaymentRequestId: opts.paymentRequestId } : {}),
    updatedAt: now(),
  })
  // Effective plan resolution is store-owned; do not duplicate an active pointer
  // inside subscription documents.
  await db.doc(`stores/${sub.storeId}`).update({ activeSubscriptionId: subId, updatedAt: now() })

  await recordBillingSnapshot(sub.storeId, {
    type: 'activation',
    planId: sub.planId,
    planName: sub.planName || plan?.name || sub.planId,
    priceMonthly: normalPriceSnapshot,
    priceYearly: yearlyPriceSnapshot,
    orderLimitPerMonth: Number(plan?.orderLimitPerMonth || 0),
    productLimit: Number(plan?.productLimit || 0),
    storageLimitMB: Number(plan?.storageLimit || 0),
    currency: store?.currency || 'SAR',
    by: actorUid,
    note: `تفعيل اشتراك (${sub.billingCycle === 'yearly' ? 'سنوي' : 'شهري'})`,
  })

  return { store, user, normalPriceSnapshot, launchPriceSnapshot, periodNumber }
}

/**
 * Compatibility path for merchant applications created under the former
 * approval-first policy. New registrations activate Free/start their SaaS
 * trial in registerMerchant and never depend on this callable.
 */
async function approveMerchantApplication(subId: string, actorUid: string) {
  const subRef = db.doc(`subscriptions/${subId}`)
  const result = await db.runTransaction(async (tx) => {
    const subSnap = await tx.get(subRef)
    if (!subSnap.exists) throw new HttpsError('not-found', 'الاشتراك غير موجود')
    const sub = subSnap.data()!
    const storeRef = db.doc(`stores/${sub.storeId}`)
    const storeSnap = await tx.get(storeRef)
    if (!storeSnap.exists) throw new HttpsError('not-found', 'المتجر غير موجود')
    const store = storeSnap.data()!
    const ownerId = String(store.ownerId || '')
    if (!ownerId) throw new HttpsError('failed-precondition', 'مالك المتجر غير محدد')
    const ownerRef = db.doc(`users/${ownerId}`)
    const ownerSnap = await tx.get(ownerRef)
    if (!ownerSnap.exists) throw new HttpsError('not-found', 'حساب التاجر غير موجود')
    const owner = ownerSnap.data()!
    if (sub.billingModel === 'one_time') throw new HttpsError('failed-precondition', 'شراء المتجر يحتاج موافقة الدفع')
    if (sub.status === 'active' || sub.status === 'trialing') return { alreadyApproved: true, status: sub.status, store, owner, storeId: sub.storeId }
    if (sub.status !== 'pending_approval' && sub.status !== 'pending') throw new HttpsError('failed-precondition', 'طلب التاجر تمت معالجته بالفعل')
    const planSnap = await tx.get(db.doc(`plans/${sub.planId}`))
    if (!planSnap.exists) throw new HttpsError('failed-precondition', 'الباقة غير موجودة')
    const plan = planSnap.data()!
    if (plan.active === false || plan.archived === true) throw new HttpsError('failed-precondition', 'الباقة غير متاحة')
    const cycle = sub.billingCycle === 'yearly' ? 'yearly' : 'monthly'
    const selectedPrice = cycle === 'yearly' ? Number(plan.priceYearly || 0) : Number(plan.priceMonthly || 0)
    const isFree = selectedPrice <= 0
    const at = new Date()
    const trialDays = isFree ? 0 : paidTrialDays(plan)
    const common = {
      approvedBy: actorUid,
      approvedAt: tsFromDate(at),
      activatedAt: tsFromDate(at),
      adminEmail: owner.email || null,
      updatedAt: now(),
    }
    const snapshot = {
      orderLimitPerMonth: Number(plan.orderLimitPerMonth || 0),
      productLimit: Number(plan.productLimit || 0),
      staffLimit: Number(plan.staffLimit || 0),
      storageLimit: Number(plan.storageLimit || 0),
      landingPagesLimit: Number(plan.landingPagesLimit || 0),
      salesLinksLimit: Number(plan.salesLinksLimit || 0),
      ...(typeof plan.unlimitedProducts === 'boolean' ? { unlimitedProducts: plan.unlimitedProducts } : {}),
      ...(typeof plan.unlimitedSalesLinks === 'boolean' ? { unlimitedSalesLinks: plan.unlimitedSalesLinks } : {}),
    }
    const flags = Object.fromEntries(PLAN_FEATURE_KEYS.map((key) => [key, plan[key] === true]))
    const subUpdate: Record<string, any> = {
      ...common,
      status: isFree ? 'active' : 'trialing',
      trialUsed: isFree ? false : true,
      trialDays: isFree ? 0 : trialDays,
      limitsSnapshot: snapshot,
      featuresSnapshot: Array.isArray(plan.features) ? plan.features : [],
      featureFlagsSnapshot: flags,
      currentPeriodStart: FieldValue.delete(),
      currentPeriodEnd: FieldValue.delete(),
      expiresAt: FieldValue.delete(),
    }
    if (isFree) {
      subUpdate.trialStatus = FieldValue.delete()
      subUpdate.trialStartedAt = FieldValue.delete()
      subUpdate.trialEndsAt = FieldValue.delete()
    } else {
      subUpdate.trialStatus = 'active'
      subUpdate.trialPlanId = sub.planId
      subUpdate.trialStartedAt = tsFromDate(at)
      subUpdate.trialEndsAt = tsFromDate(new Date(at.getTime() + trialDays * DAY_MS))
    }
    tx.update(subRef, subUpdate)
    tx.update(ownerRef, { active: true, merchantStatus: 'active', updatedAt: now() })
    // Approval does not publish the storefront.  It only clears the account
    // application gate; the merchant must publish separately.
    tx.update(storeRef, { active: true, approvalStatus: 'active', status: 'draft', storeStatus: 'draft', published: false, updatedAt: now() })
    return { alreadyApproved: false, status: isFree ? 'active' : 'trialing', store, owner, storeId: sub.storeId, planName: plan.name || sub.planName }
  })
  if (!result.alreadyApproved) await auth.updateUser(result.store.ownerId, { disabled: false }).catch(() => {})
  return result
}

// ─────────────────────────────────────────────────────────────
// 1. generateOrderNumber — unique ORD-NNNNN under concurrency
// ─────────────────────────────────────────────────────────────
export const generateOrderNumber = onCall(async (request: CallableRequest<{ storeId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId } = request.data || {}
  if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')

  await assertStoreAccess(request, storeId, 'orders:view')

  const counterRef = db.doc(`stores/${storeId}/counters/orders`)

  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef)
    const next = (snap.exists ? snap.data()?.value : 0) + 1
    tx.set(counterRef, { value: next }, { merge: true })
    return next
  })

  return { orderNumber: `ORD-${String(seq).padStart(5, '0')}` }
})

// ─────────────────────────────────────────────────────────────
// 2. createOrder — atomic stock deduction + order creation
// ─────────────────────────────────────────────────────────────
export const createOrder = onCall({ region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey] }, async (request: CallableRequest<any>) => {
  const { storeId, items, customer, paymentMethod, salesLinkRef, landingPageId, campaignId, utmSource, utmCampaign } = request.data || {}
  const requestedShippingProviderId = String(request.data?.shippingProviderId || '').trim()
  const requestedShippingServiceCode = String(request.data?.shippingServiceCode || '').trim()
  const requestedCouponCode = String(request.data?.couponCode || '').trim().toUpperCase()
  if (!storeId || !Array.isArray(items) || items.length === 0) throw new HttpsError('invalid-argument', 'بيانات الطلب غير مكتملة')
  if (!customer?.name || !customer?.phone) throw new HttpsError('invalid-argument', 'بيانات العميل مطلوبة')

  const allowedPayments = ['cod', 'bank']
  if (paymentMethod && !allowedPayments.includes(paymentMethod)) {
    throw new HttpsError('invalid-argument', 'طريقة دفع غير صالحة')
  }

  // Bank-transfer orders must carry an image receipt. The upload is handled
  // by this callable (not public Storage rules), so guest checkout remains
  // possible without making customers capable of writing to tenant storage.
  let bankProof: { buffer: Buffer; contentType: string; originalName: string } | null = null
  if (paymentMethod === 'bank') {
    const proof = request.data?.bankTransferProof || {}
    const contentType = String(proof.contentType || '')
    const allowedProofTypes = ['image/jpeg', 'image/png', 'image/webp']
    const encoded = String(proof.dataUrl || '')
    const base64 = encoded.includes(',') ? encoded.slice(encoded.indexOf(',') + 1) : ''
    if (!allowedProofTypes.includes(contentType) || !base64) {
      throw new HttpsError('invalid-argument', 'أرفق صورة واضحة لإثبات التحويل (JPG أو PNG أو WebP)')
    }
    const buffer = Buffer.from(base64, 'base64')
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'حجم إثبات التحويل يجب ألا يتجاوز 5 ميجابايت')
    }
    bankProof = { buffer, contentType, originalName: String(proof.name || 'bank-transfer-proof').slice(0, 120) }
  }

  // Verify store exists, is active and published (IDOR mitigation — never trust
  // storeId without validation). Unpublished stores reject purchases.
  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) {
    throw new HttpsError('not-found', 'المتجر غير موجود أو غير مفعل')
  }
  if (storePublicationStatus(storeSnap.data()) !== 'published') {
    throw new HttpsError('failed-precondition', 'المتجر غير منشور بعد')
  }

  // Check subscription grant before creating the order. The ordersUsed counter
  // on the granting subscription tracks orders created in the current period
  // (trial OR paid) and resets when a new paid period starts (activation).
  const grant = await grantForStore(storeId, request.auth?.uid)
  if (!grant) {
    throw new HttpsError('failed-precondition', 'الاشتراك غير نشط — المتجر لا يقبل الطلبات حالياً')
  }
  const subRef = db.doc(`subscriptions/${grant.subId}`)
  const sub = grant.sub
  const plan = grant.plan
  const orderLimit = Number(plan?.orderLimitPerMonth || 0)
  const ordersUsed = Number(sub.ordersUsed || 0)
  if (orderLimit > 0 && ordersUsed >= orderLimit) {
    throw new HttpsError('resource-exhausted', `تم تجاوز حد الطلبات الشهري (${orderLimit})`)
  }
  const orderId = db.collection('orders').doc().id
  const bankProofPath = bankProof ? `documents/${storeId}/order-payment-proofs/${orderId}/proof-${Date.now()}.${bankProof.contentType === 'image/png' ? 'png' : bankProof.contentType === 'image/webp' ? 'webp' : 'jpg'}` : null

  const storeData = storeSnap.data()!
  // Resolve campaign attribution server-side. Client identifiers are only
  // hints; ownership is checked against the current store before snapshotting.
  let campaignSnapshot: any = null
  if (campaignId) {
    const campaignDoc = await db.doc(`adCampaigns/${String(campaignId)}`).get()
    if (campaignDoc.exists && campaignDoc.data()?.storeId === storeId) {
      const c = campaignDoc.data() || {}
      const attributedOrders = Number(c.attributedOrders || 0)
      const spend = Number(c.totalSpend || 0)
      campaignSnapshot = { id: campaignDoc.id, name: String(c.name || ''), costPerOrder: attributedOrders > 0 && spend >= 0 ? spend / attributedOrders : null }
    }
  }
  const shippingCfg = storeData.shipping
  // Pre-fetch zones for the zones shipping model. All reads must happen before
  // any writes within the transaction, and the subtotal is only known mid-tx,
  // so zones are fetched up-front and matched inside the transaction.
  const zonesSnap = !requestedShippingProviderId && shippingCfg?.enabled && shippingCfg?.model === 'zones'
    ? await db.collection('shipping').where('storeId', '==', storeId).where('active', '==', true).get()
    : null
  const zones = zonesSnap ? zonesSnap.docs.map((d) => ({ ...d.data(), id: d.id })) : []
  let selectedShippingProvider: Record<string, any> | null = null
  let selectedShippingConfig: Record<string, any> | null = null
  let selectedShippingCredentials: Record<string, unknown> | null = null
  if (requestedShippingProviderId) {
    const [providerSnap, configSnap] = await Promise.all([
      db.doc(`shippingProviders/${requestedShippingProviderId}`).get(),
      db.doc(`storeShippingProviders/${storeId}_${requestedShippingProviderId}`).get(),
    ])
    if (!providerSnap.exists || providerSnap.data()?.status !== 'active' || !configSnap.exists || configSnap.data()?.enabled !== true) {
      throw new HttpsError('failed-precondition', 'شركة الشحن المختارة غير متاحة لهذا المتجر')
    }
    selectedShippingProvider = { id: providerSnap.id, ...(providerSnap.data() || {}) }
    selectedShippingConfig = configSnap.data() || {}
    if (String(selectedShippingProvider.slug || '').toLowerCase() === 'wasla') {
      const vault = await loadIntegrationCredentials(db, String(storeId), 'shipping', 'wasla').catch(() => null)
      if (!vault) throw new HttpsError('failed-precondition', 'أكمل التاجر حفظ مفتاح وصلة واختبار الاتصال أولاً')
      selectedShippingCredentials = vault.credentials
    }
  }

  // Upsert, never duplicate: reuse an existing customer for the same store when
  // the phone already exists. Uses phoneNormalized to avoid fragmented duplicates
  // like 010…, +2010…, 002010… Keep legacy phone match as fallback.
  const normalizedPhone = normalizePhoneEG(customer.phone)
  let existingCustomerDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null
  if (normalizedPhone) {
    const byNorm = await db.collection('customers')
      .where('storeId', '==', storeId)
      .where('phoneNormalized', '==', normalizedPhone)
      .limit(1)
      .get()
    if (!byNorm.empty) existingCustomerDoc = byNorm.docs[0]
  }
  if (!existingCustomerDoc) {
    const byRaw = await db.collection('customers')
      .where('storeId', '==', storeId)
      .where('phone', '==', String(customer.phone))
      .limit(1)
      .get()
    if (!byRaw.empty) existingCustomerDoc = byRaw.docs[0]
  }
  const customerType = request.auth?.uid ? 'registered' : 'guest'

  // Resolve the coupon before the transaction, then re-read it transactionally
  // before incrementing usage so maxUses cannot be exceeded concurrently.
  let couponRef: DocumentReference | null = null
  if (requestedCouponCode) {
    const couponQuery = await db.collection('coupons')
      .where('storeId', '==', storeId)
      .where('code', '==', requestedCouponCode)
      .limit(1)
      .get()
    if (couponQuery.empty) throw new HttpsError('failed-precondition', 'كود الخصم غير صالح')
    couponRef = couponQuery.docs[0].ref
  }

  // Private historical cost snapshot. Read before the transaction and store it
  // in orderCosts/{orderId}, never inside the customer-readable order document.
  const productIds = Array.from(new Set(items.map((item: any) => String(item.productId || '')).filter(Boolean)))
  const costSnaps = await Promise.all(productIds.map((id) => db.doc(`productCosts/${id}`).get()))
  const productCostById = new Map<string, any>()
  for (const snap of costSnaps) {
    if (snap.exists) productCostById.set(snap.id, snap.data())
  }

  if (bankProof && bankProofPath) {
    try {
      await admin.storage().bucket(STORAGE_BUCKET).file(bankProofPath).save(bankProof.buffer, {
        resumable: false,
        metadata: {
          contentType: bankProof.contentType,
          metadata: { storeId, orderId, kind: 'order-bank-transfer-proof' },
        },
      })
    } catch {
      throw new HttpsError('unavailable', 'تعذر رفع إثبات التحويل، تحقق من الاتصال وحاول مرة أخرى')
    }
  }

  const result = await db.runTransaction(async (tx) => {
    const lineItems: any[] = []
    const orderCostItems: any[] = []
    let subtotal = 0
    let salesLinkId: string | null = null
    let salesLinkStaffId: string | null = null
    let salesLinkSnapshot: any = null
    let landingPageSnapshot: any = null
    let shippingSnapshot: any = { enabled: false }
    let discount = 0

    // Re-read the granting subscription INSIDE the transaction so the
    // ordersUsed limit is enforced atomically. The pre-check above only gives a
    // fast failure path; concurrent orders must never overshoot the plan limit.
    const subTxSnap = await tx.get(subRef)
    if (subTxSnap.exists && orderLimit > 0 && Number(subTxSnap.data()?.ordersUsed || 0) >= orderLimit) {
      throw new HttpsError('resource-exhausted', `تم تجاوز حد الطلبات الشهري (${orderLimit})`)
    }

    // Read the order counter first — Firestore requires all reads to happen
    // before any writes within a transaction.
    const counterRef = db.doc(`stores/${storeId}/counters/orders`)
    const counterSnap = await tx.get(counterRef)
    const seq = (counterSnap.exists ? counterSnap.data()?.value : 0) + 1
    const orderNumber = `ORD-${String(seq).padStart(5, '0')}`
    const couponSnap = couponRef ? await tx.get(couponRef) : null

    for (const item of items) {
      const productSnap = await tx.get(db.doc(`products/${item.productId}`))
      if (!productSnap.exists) throw new HttpsError('failed-precondition', `المنتج ${item.productId} غير موجود`)
      const product = productSnap.data()!

      // Multi-tenancy guard: the product must belong to the order's store.
      if (product.storeId !== storeId) {
        throw new HttpsError('permission-denied', `المنتج ${product.name} لا ينتمي إلى هذا المتجر`)
      }
      if (!product.active) throw new HttpsError('failed-precondition', `المنتج ${product.name} غير متاح`)

      // Quantity must be a positive integer — a negative/zero qty would pass the
      // stock check, inflate stock via increment(-qty) and produce negative prices.
      const qty = Number(item.quantity)
      if (!Number.isInteger(qty) || qty < 1 || qty > 9999) {
        throw new HttpsError('invalid-argument', `كمية غير صالحة للمنتج ${product.name}`)
      }

      // Match the exact variant: prefer variantId (new checkout), then fall
      // back to color+size, color-only or size-only matching for legacy items.
      let matchedVariant: any = null
      if (Array.isArray(product.variants)) {
        if (item.variantId) {
          matchedVariant = product.variants.find((v: any) => v.id === item.variantId) || null
        }
        if (!matchedVariant) {
          const normColor = item.color || ''
          const normSize = item.size || ''
          matchedVariant =
            product.variants.find((v: any) => (v.color || '') === normColor && (v.size || '') === normSize) ||
            (normColor
              ? product.variants.find((v: any) => (v.color || '') === normColor && !v.size) || null
              : null) ||
            (normSize
              ? product.variants.find((v: any) => !v.color && (v.size || '') === normSize) || null
              : null) ||
            null
        }
      }
      if (matchedVariant) {
        if ((matchedVariant.stock || 0) < qty) {
          throw new HttpsError('failed-precondition', `الكمية غير متوفرة لـ ${product.name}`)
        }
        // Single source of truth: decrement ONLY the matched variant. The flat
        // `stock` field is a derived aggregate (sum of variant stock) for variant
        // products — recompute it here rather than decrementing it independently,
        // which would double-subtract the same units.
        matchedVariant.stock -= qty
        const aggStock = product.variants.reduce((s: number, v: any) => s + (v.stock || 0), 0)
        tx.update(db.doc(`products/${item.productId}`), { variants: product.variants, stock: aggStock })
      } else if (Array.isArray(product.variants) && product.variants.length > 0) {
        // The product defines variants but the submitted variantId / color+size
        // resolves to none. This is a manipulated or stale request — do NOT fall
        // back to decrementing the flat aggregate stock, which would silently
        // mis-attribute inventory to a non-existent variant. Reject instead.
        throw new HttpsError('failed-precondition', `المتغير غير موجود للمنتج ${product.name}`)
      } else {
        if ((product.stock || 0) < qty) throw new HttpsError('failed-precondition', `الكمية غير متوفرة لـ ${product.name}`)
        tx.update(db.doc(`products/${item.productId}`), { stock: FieldValue.increment(-qty) })
      }

      // Resolve pricing server-side. Quantity-tier pricing is recomputed
      // from the stored product, never trusted from the client.
      // Bundle tiers: the tier's TOTAL price is the line total (no multiply).
      // Standard/legacy: unit price × quantity.
      const basePrice = typeof matchedVariant?.price === 'number' ? matchedVariant.price : (Number(product.price) || 0)
      const pricingMode: string = product.pricingMode === 'quantity' ? 'quantity' : 'standard'
      const pricingStrategy: string = product.quantityPricingStrategy || 'cap'
      let unit = basePrice
      let lineTotal = 0
      let quantityTier: { quantity: number; price: number } | null = null
      if (pricingMode === 'quantity') {
        const bundleTotal = tierTotalForQuantity(product.quantityTiers, qty, pricingStrategy)
        if (bundleTotal != null) {
          unit = bundleTotal / qty
          lineTotal = bundleTotal
          quantityTier = { quantity: qty, price: bundleTotal }
        } else {
          unit = unitPriceForQty(basePrice, qty, pricingMode, product.quantityTiers, pricingStrategy)
          lineTotal = unit * qty
        }
      } else {
        unit = unitPriceForQty(basePrice, qty, pricingMode, product.quantityTiers, pricingStrategy)
        lineTotal = unit * qty
      }
      subtotal += lineTotal
      const variantId = matchedVariant?.id || item.variantId
      const lineId = `${item.productId}-${variantId || `${item.color || ''}-${item.size || ''}`}`
      const costDoc = productCostById.get(item.productId)
      const rawVariantCost = variantId && costDoc?.variantCosts && typeof costDoc.variantCosts[variantId] === 'number'
        ? Number(costDoc.variantCosts[variantId])
        : null
      const productCost = typeof costDoc?.costPrice === 'number' ? Number(costDoc.costPrice) : null
      const hasVariantCost = rawVariantCost != null && Number.isFinite(rawVariantCost) && rawVariantCost >= 0
      const costPrice = hasVariantCost
        ? rawVariantCost
        : productCost != null && Number.isFinite(productCost) && productCost >= 0
          ? productCost
          : null
      const estimatedAdCost = typeof costDoc?.estimatedAdCostPerSale === 'number' && Number.isFinite(costDoc.estimatedAdCostPerSale) && costDoc.estimatedAdCostPerSale >= 0
        ? Number(costDoc.estimatedAdCostPerSale)
        : 0
      const estimatedAdCostMode = costDoc?.estimatedAdCostMode === 'per_item' ? 'per_item' : 'per_order'
      if (costPrice != null || estimatedAdCost > 0) {
        orderCostItems.push({
          lineId,
          productId: item.productId,
          variantId: variantId || null,
          quantity: qty,
          costPrice: costPrice ?? 0,
          source: hasVariantCost ? 'variant' : 'product',
          estimatedAdCostSnapshot: estimatedAdCost,
          estimatedAdCostMode,
          capturedAt: Timestamp.now(),
        })
      }
      lineItems.push({
        id: lineId,
        productId: item.productId,
        name: product.name,
        price: unit,
        unitPrice: unit,
        quantity: qty,
        pricingMode,
        lineTotal,
        ...(quantityTier ? { quantityTier } : {}),
        ...(pricingMode === 'quantity' ? { quantityPricingStrategy: pricingStrategy } : {}),
        color: (matchedVariant?.color ?? item.color) || '',
        size: (matchedVariant?.size ?? item.size) || '',
        ...(variantId ? { variantId } : {}),
      })
    }

    if (couponSnap) {
      const coupon = couponSnap.data() || {}
      // A platform-issued campaign is intentionally usable even when the
      // merchant's own plan does not include coupon management. Merchant
      // coupons remain subject to the store's plan entitlement.
      const platformIssued = coupon.source === 'platform' || coupon.createdByRole === 'superAdmin'
      if (!platformIssued && !canUseFeature(plan, 'coupons')) {
        throw new HttpsError('failed-precondition', 'الكوبونات غير متاحة في باقة هذا المتجر')
      }
      if (!coupon.active) throw new HttpsError('failed-precondition', 'كود الخصم غير نشط')
      const expiresAt = coupon.expiresAt
      const expiryMs = expiresAt?.toMillis ? expiresAt.toMillis() : expiresAt?.seconds ? Number(expiresAt.seconds) * 1000 : null
      if (expiryMs && expiryMs <= Date.now()) throw new HttpsError('failed-precondition', 'انتهت صلاحية كود الخصم')
      if (Number(coupon.maxUses || 0) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.maxUses)) {
        throw new HttpsError('failed-precondition', 'اكتمل استخدام كود الخصم')
      }
      if (Number(coupon.minOrder || 0) > subtotal) throw new HttpsError('failed-precondition', 'الطلب لا يحقق الحد الأدنى للكوبون')
      const value = Number(coupon.value || 0)
      if (discount <= 0) throw new HttpsError('failed-precondition', 'قيمة كود الخصم غير صالحة')
      tx.update(couponRef!, { usedCount: FieldValue.increment(1), updatedAt: now() })
    }

    tx.set(counterRef, { value: seq }, { merge: true })

    if (salesLinkRef) {
      const linkQuery = await db.collection('storeLinks')
        .where('storeId', '==', storeId)
        .where('code', '==', salesLinkRef)
        .limit(1)
        .get()
      if (!linkQuery.empty) {
        const linkDoc = linkQuery.docs[0]
        const linkData = linkDoc.data()
        // Orders and revenue are counted on the link only when the order is
        // DELIVERED (canonical revenue rule) — updateOrderStatus adjusts the
        // counters on the DELIVERED transition. Here we only snapshot.
        tx.update(linkDoc.ref, { updatedAt: now() })
        salesLinkId = linkDoc.id
        salesLinkStaffId = linkData?.staffId || null
        salesLinkSnapshot = {
          code: linkData?.code || salesLinkRef,
          title: linkData?.title || '',
          sellerName: linkData?.sellerName || '',
          destinationType: linkData?.destinationType || 'home',
        }
      }
    }

    if (landingPageId) {
      // Landing-page attribution. Orders/revenue are counted on the landing page
      // only when the order is DELIVERED (canonical revenue rule) — here we only
      // validate tenant ownership + snapshot the page metadata.
      const landingDoc = await db.collection('landingPages').doc(landingPageId).get()
      if (landingDoc.exists) {
        const landingData = landingDoc.data()
        if (landingData?.storeId === storeId) {
          landingPageSnapshot = {
            slug: landingData?.slug || '',
            title: landingData?.title || '',
          }
        }
      }
    }

    // Resolve the canonical provider quote server-side. Legacy store config
    // and zones are only a compatibility fallback when no provider was sent.
    let shipping = computeShippingFee(shippingCfg, zones, subtotal, customer.governorate || '')
    if (selectedShippingProvider && selectedShippingConfig) {
      const adapter = getShippingRateAdapter(selectedShippingProvider.slug, selectedShippingProvider.integrationType)
      const rates = adapter?.getRates
        ? await adapter.getRates({ provider: selectedShippingProvider, config: selectedShippingConfig, credentials: selectedShippingCredentials }, { subtotal, currency: storeData.currency || 'EGP', governorate: customer.governorate || '', city: customer.city || '', area: customer.area || '', weightKg: Math.max(0, Number(request.data?.packageWeightKg || selectedShippingConfig.defaultPackageWeight || 1)) })
        : []
      const enabledCodes = Array.isArray(selectedShippingConfig.enabledServiceCodes) ? selectedShippingConfig.enabledServiceCodes.map(String) : []
      const matchingRates = rates.filter((candidate) => !enabledCodes.length || enabledCodes.includes(String(candidate.serviceCode || '')))
      const rate = matchingRates.find((candidate) => !requestedShippingServiceCode || String(candidate.serviceCode || '') === requestedShippingServiceCode) || matchingRates[0]
      if (!rate) throw new HttpsError('failed-precondition', 'شركة الشحن المختارة لا تقدم سعراً لهذه الوجهة')
      shipping = {
        available: true,
        fee: Number(rate.amount || 0),
        method: String(rate.serviceName || rate.name || selectedShippingProvider.name || 'شحن'),
        policy: String(shippingCfg?.refusedPolicy || ''),
        snapshot: {
          enabled: true,
          providerId: selectedShippingProvider.id,
          providerName: selectedShippingProvider.name,
          providerSlug: selectedShippingProvider.slug,
          serviceCode: rate.serviceCode || selectedShippingConfig.serviceCode || null,
          serviceName: rate.serviceName || rate.name || selectedShippingProvider.name,
          rate: Number(rate.amount || 0),
          customerShippingFee: Number(rate.amount || 0),
          currency: rate.currency || storeData.currency || 'EGP',
          etaMin: rate.etaMin ?? null,
          etaMax: rate.etaMax ?? null,
          etaUnit: rate.etaUnit || 'hours',
          codAvailable: rate.codAvailable === true,
          trackingAvailable: rate.trackingAvailable === true,
          zoneId: rate.zoneId || null,
          zoneName: rate.zoneName || null,
          codFee: Number(rate.codFee || 0),
          returnFee: Number(rate.returnFee || 0),
          weightKg: Number(rate.weightKg || 0),
        },
      }
    }
    if (!shipping.available) throw new HttpsError('failed-precondition', shipping.unavailableReason || 'الشحن غير متوفر لهذه الوجهة')
    shippingSnapshot = shipping.snapshot

    // Customer upsert — one Customer doc per (storeId, phoneNormalized).
    // Reuse the existing doc when present, otherwise create. Never duplicates.
    // Also maintains CRM denorm: phoneNormalized, attribution, and stage fallback.
    let customerDocId: string
    const attributionPatch: Record<string, any> = {}
    if (salesLinkId) { attributionPatch.lastSalesLinkId = salesLinkId; attributionPatch.lastSalesLinkCode = salesLinkRef || null }
    if (campaignSnapshot?.id) { attributionPatch.lastCampaignId = campaignSnapshot.id; attributionPatch.attributionSource = salesLinkId ? 'sales_link' : landingPageSnapshot ? 'landing_page' : 'campaign_parameter' }
    if (utmSource) attributionPatch.lastUtmSource = String(utmSource).slice(0, 120)
    if (utmCampaign) attributionPatch.lastUtmCampaign = String(utmCampaign).slice(0, 120)
    if (existingCustomerDoc) {
      customerDocId = existingCustomerDoc.id
      tx.update(db.doc(`customers/${customerDocId}`), {
        name: customer.name,
        phone: customer.phone,
        phoneNormalized: normalizedPhone || existingCustomerDoc.data()?.phoneNormalized || null,
        governorate: customer.governorate || '',
        city: customer.city || '',
        area: customer.area || '',
        address: customer.address || '',
        note: customer.notes || null,
        ...(customerType === 'registered' ? { type: 'registered', userId: request.auth?.uid || null } : {}),
        totalOrders: FieldValue.increment(1),
        totalSpent: FieldValue.increment(subtotal - discount),
        lastOrderAt: now(),
        updatedAt: now(),
        ...attributionPatch,
      })
    } else {
      customerDocId = db.collection('customers').doc().id
      tx.set(db.doc(`customers/${customerDocId}`), {
        storeId,
        name: customer.name,
        phone: customer.phone,
        phoneNormalized: normalizedPhone || null,
        governorate: customer.governorate || '',
        city: customer.city || '',
        area: customer.area || '',
        address: customer.address || '',
        segment: null,
        stage: 'new',
        tags: [],
        note: customer.notes || null,
        notes: [],
        type: customerType,
        userId: request.auth?.uid || null,
        totalOrders: FieldValue.increment(1),
        totalSpent: FieldValue.increment(subtotal - discount),
        lastOrderAt: now(),
        pendingFollowUpsCount: 0,
        nextFollowUpAt: null,
        createdAt: now(),
        updatedAt: now(),
        createdBy: 'system',
        ...attributionPatch,
      })
    }

    tx.set(db.doc(`orders/${orderId}`), {
      storeId,
      orderNumber,
      customerName: customer.name,
      phone: customer.phone,
      governorate: customer.governorate || '',
      city: customer.city || '',
      area: customer.area || '',
      address: customer.address || '',
      notes: customer.notes || null,
      customerId: request.auth?.uid || null,
      customerType,
      customerDocId,
      items: lineItems,
      subtotal,
      shippingFee: shipping.fee,
      shippingMethod: shipping.method,
      shippingProviderId: selectedShippingProvider?.id || null,
      shippingProviderName: selectedShippingProvider?.name || null,
      shippingRate: shipping.fee,
      shippingSnapshot,
      discount,
      totalPrice: subtotal + shipping.fee - discount,
      status: 'NEW',
      statusHistory: [{ status: 'NEW', at: Timestamp.now(), by: request.auth?.uid || 'guest' }],
      paymentMethod: paymentMethod || 'cod',
      paymentStatus: paymentMethod === 'bank' ? 'PENDING_REVIEW' : 'UNPAID',
      bankTransferProof: bankProofPath ? {
        path: bankProofPath,
        originalName: bankProof?.originalName || 'bank-transfer-proof',
        contentType: bankProof?.contentType || null,
        uploadedAt: now(),
      } : null,
      couponCode: requestedCouponCode || null,
      trackingCode: null,
      salesLinkRef: salesLinkRef || null,
      salesLinkId,
      salesLinkStaffId,
      salesLinkSnapshot,
      landingPageId: landingPageSnapshot ? landingPageId : null,
      landingPageSnapshot,
      campaignId: campaignSnapshot?.id || null,
      campaignNameSnapshot: campaignSnapshot?.name || null,
      attributionSource: campaignSnapshot ? (salesLinkId ? 'sales_link' : landingPageSnapshot ? 'landing_page' : 'campaign_parameter') : null,
      utmSource: typeof utmSource === 'string' ? utmSource.slice(0, 120) : null,
      utmCampaign: typeof utmCampaign === 'string' ? utmCampaign.slice(0, 120) : null,
      createdAt: now(),
      updatedAt: now(),
      createdBy: request.auth?.uid || 'guest',
    })

    emitIntegrationEvent(db, tx, {
      eventId: `order-created-${orderId}`,
      storeId,
      eventType: 'order.created',
      entityType: 'order',
      entityId: orderId,
      payload: {
        orderId,
        orderNumber,
        customerId: customerDocId,
        totalPrice: subtotal + shipping.fee - discount,
        shippingProviderId: selectedShippingProvider?.id || null,
      },
    })
    // CRM Timeline — order created
    await emitCustomerTimeline(tx, {
      storeId,
      customerId: customerDocId,
      type: 'order.created',
      title: `طلب جديد ${orderNumber}`,
      body: `إجمالي ${subtotal + shipping.fee - discount} — ${lineItems.length} منتج`,
      orderId,
      orderNumber,
      meta: { totalPrice: subtotal + shipping.fee - discount, items: lineItems.length, paymentMethod: paymentMethod || 'cod' },
      createdBy: request.auth?.uid || 'guest',
    })
    if (!existingCustomerDoc) {
      emitIntegrationEvent(db, tx, {
        eventId: `customer-created-${customerDocId}`,
        storeId,
        eventType: 'customer.created',
        entityType: 'customer',
        entityId: customerDocId,
        payload: { customerId: customerDocId, phone: customer.phone, type: customerType },
      })
      await emitCustomerTimeline(tx, {
        storeId,
        customerId: customerDocId,
        type: 'customer.created',
        title: 'عميل جديد',
        body: `${customer.name} — ${customer.phone}`,
        meta: { phoneNormalized: normalizedPhone },
        createdBy: request.auth?.uid || 'guest',
      })
    }

    tx.set(db.doc(`orderCosts/${orderId}`), {
      id: orderId,
      orderId,
      storeId,
      items: orderCostItems.map((item: any) => campaignSnapshot?.costPerOrder != null ? { ...item, estimatedAdCostSnapshot: campaignSnapshot.costPerOrder, estimatedAdCostMode: 'per_order' } : item),
      createdAt: now(),
      updatedAt: now(),
      createdBy: 'system',
    })

    // Atomically consume one order slot from the active subscription. The
    // enforcement check above read the same counter, so concurrent orders can
    // never overshoot the plan limit.
    tx.update(subRef, { ordersUsed: FieldValue.increment(1), updatedAt: now() })

    return { orderId, orderNumber, totalPrice: subtotal + shipping.fee - discount, shippingFee: shipping.fee, discount, couponCode: requestedCouponCode || null, customerId: customerDocId }
  })

  await bumpAnalytics(storeId, { totalPrice: result.totalPrice, status: 'NEW', countOrder: true }).catch(() => {})

  await auditLog(storeId, request.auth?.uid || 'guest', 'create_order', 'orders', result.orderId, { orderNumber: result.orderNumber, totalPrice: result.totalPrice })

  return result
})

// ─────────────────────────────────────────────────────────────
// 3b. createProduct — merchant creates a product with plan limit enforcement.
//     Accepts the full product shape (the same payload the ProductForm builds)
//     at a client-supplied id so product images (uploaded under that id first)
//     line up with the created record. Updates/deletes remain direct writes.
// ─────────────────────────────────────────────────────────────
export const createProduct = onCall(async (request: CallableRequest<any>) => {
  await assertStoreAccess(request, request.data?.storeId, ['products:create', 'products:edit'])
  const { storeId, productId, data } = request.data || {}
  if (!storeId || !productId || !data || !data.name) throw new HttpsError('invalid-argument', 'بيانات المنتج غير مكتملة')
  if (typeof data.price !== 'number' || data.price < 0) throw new HttpsError('invalid-argument', 'السعر غير صالح')

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) {
    throw new HttpsError('not-found', 'المتجر غير موجود أو غير مفعل')
  }

   // Check subscription grant + product limit from the plan. Trial and active
   // subscriptions both grant the full features of the selected plan.
   const grant = await grantForStore(storeId, request.auth?.uid)
   if (!grant) {
     throw new HttpsError('failed-precondition', 'الاشتراك غير نشط — لا يمكن إضافة منتجات حالياً. فعّل باقتك أولاً.')
   }
   const productLimit = resolvedLimit(grant.plan, 'productLimit', 'unlimitedProducts')
  // The quota check and document creation below share one transaction.  A
  // count followed by a separate write lets concurrent requests both observe
  // the last available slot and exceed the plan limit.

  // Phase 7 feature gates: advanced product modes are plan features. A product
  // with variants (precomputed color/size matrix) or quantity pricing requires
  // the matching plan flag; flat standard-price products are allowed everywhere.
  const variantProduct = Array.isArray(data.variants) && data.variants.length > 0
  const quantityProduct = data.pricingMode === 'quantity' && Array.isArray(data.quantityTiers) && data.quantityTiers.length > 0
  if (variantProduct && !canUseFeature(grant.plan, 'variantInventory')) {
    throw new HttpsError('resource-exhausted', 'ميزة المخزون حسب المقاس/اللون غير متوفرة في باقتك الحالية — ارتقِ باقتك لتفعيلها.')
  }
  if (quantityProduct && !canUseFeature(grant.plan, 'quantityPricing')) {
    throw new HttpsError('resource-exhausted', 'ميزة التسعير بالكمية غير متوفرة في باقتك الحالية — ارتقِ باقتك لتفعيلها.')
  }

  const productRef = db.doc(`products/${productId}`)
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(productRef)
    if (existing.exists) throw new HttpsError('already-exists', 'يوجد منتج بهذا المعرّف')
    if (productLimit !== null) {
      const existingProducts = await tx.get(db.collection('products').where('storeId', '==', storeId))
      if (existingProducts.size >= productLimit) {
        throw new HttpsError('resource-exhausted', `تم تجاوز حد المنتجات (${productLimit})`)
      }
    }
    tx.create(productRef, {
      ...data,
      id: productId,
      storeId,
      createdAt: now(),
      updatedAt: now(),
      createdBy: request.auth?.uid || 'guest',
    })
  })

  await auditLog(storeId, request.auth?.uid || 'guest', 'create_product', 'products', productId, { name: data.name })

  return { id: productId, name: data.name }
})

// Product edits that can introduce variants or quantity pricing must use the
// same server entitlement gate as creation.  Direct Firestore edits remain
// available only for the small operational fields allowed by firestore.rules.
export const updateProduct = onCall(async (request: CallableRequest<any>) => {
  await assertStoreAccess(request, request.data?.storeId, ['products:edit', 'products:create'])
  const { storeId, productId, data } = request.data || {}
  if (!storeId || !productId || !data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'بيانات المنتج غير مكتملة')
  }
  const productRef = db.doc(`products/${productId}`)
  const existingSnap = await productRef.get()
  if (!existingSnap.exists || existingSnap.data()?.storeId !== storeId) {
    throw new HttpsError('not-found', 'المنتج غير موجود ضمن هذا المتجر')
  }
  const grant = await grantForStore(storeId, request.auth?.uid)
  if (!grant) throw new HttpsError('failed-precondition', 'الاشتراك غير نشط — لا يمكن تعديل المنتجات حالياً')
  const variantProduct = Array.isArray(data.variants) && data.variants.length > 0
  const quantityProduct = data.pricingMode === 'quantity' && Array.isArray(data.quantityTiers) && data.quantityTiers.length > 0
  if (variantProduct && !canUseFeature(grant.plan, 'variantInventory')) {
    throw new HttpsError('resource-exhausted', 'ميزة المخزون حسب المقاس/اللون غير متوفرة في باقتك الحالية')
  }
  if (quantityProduct && !canUseFeature(grant.plan, 'quantityPricing')) {
    throw new HttpsError('resource-exhausted', 'ميزة التسعير بالكمية غير متوفرة في باقتك الحالية')
  }
  if (data.price !== undefined && (typeof data.price !== 'number' || data.price < 0)) {
    throw new HttpsError('invalid-argument', 'السعر غير صالح')
  }
  const patch: Record<string, any> = { ...data }
  delete patch.id
  delete patch.storeId
  delete patch.createdAt
  delete patch.createdBy
  patch.updatedAt = now()
  await productRef.update(patch)
  await auditLog(storeId, request.auth!.uid, 'update_product', 'products', productId, { name: data.name || existingSnap.data()?.name })
  return { id: productId }
})

// Deletes a product and its now-orphaned private media through the server.
// Keeping this operation together avoids a client-side Firestore/Storage race:
// a stale collection snapshot must never make the product's own image look
// shared, and Storage authorization/cleanup should use the same tenant check.
export const deleteProduct = onCall(async (request: CallableRequest<{ storeId?: string; productId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, productId } = request.data || {}
  if (!storeId || !productId) throw new HttpsError('invalid-argument', 'storeId و productId مطلوبان')
  await assertStoreAccess(request, storeId, ['products:edit', 'products:create'])

  const productRef = db.doc(`products/${productId}`)
  const productSnap = await productRef.get()
  if (!productSnap.exists || productSnap.data()?.storeId !== storeId) {
    throw new HttpsError('not-found', 'المنتج غير موجود ضمن هذا المتجر')
  }
  const product = productSnap.data() || {}
  const otherSnap = await db.collection('products').where('storeId', '==', storeId).get()
  const referenced = new Set<string>()
  for (const doc of otherSnap.docs) {
    if (doc.id === productId) continue
    for (const image of doc.data()?.images || []) referenced.add(String(image))
  }

  await productRef.delete()
  await db.doc(`productCosts/${productId}`).delete().catch(() => {})

  const bucket = admin.storage().bucket(STORAGE_BUCKET)
  for (const image of Array.isArray(product.images) ? product.images : []) {
    if (referenced.has(String(image))) continue
    try {
      const parsed = new URL(String(image))
      const match = parsed.pathname.match(/\/o\/(.+)$/)
      if (!match) continue
      await bucket.file(decodeURIComponent(match[1])).delete({ ignoreNotFound: true })
    } catch {
      // Legacy/external URLs are not owned storage objects; document deletion
      // remains successful and those URLs are intentionally left untouched.
    }
  }
  await auditLog(storeId, request.auth.uid, 'delete_product', 'products', productId, { name: product.name || '' })
  return { id: productId }
})

// ─────────────────────────────────────────────────────────────
// 4. registerMerchant — tenant + store + owner creation.
//     Every new merchant starts one server-timed 30-day Free trial. A plan
//     selected on the public pricing page is upgrade intent only and never
//     grants paid entitlements before payment approval. Store publication
//     remains an independent, explicit merchant action.
// ─────────────────────────────────────────────────────────────
export const registerMerchant = onCall(async (request: CallableRequest<any>) => {
  const { email, password, name, phone, storeName, storeRef, planId } = request.data || {}
  if (!email || !password || !name || !storeName) throw new HttpsError('invalid-argument', 'بيانات التسجيل غير مكتملة')

  const uid = db.collection('users').doc().id
  const storeId = db.collection('stores').doc().id
  const baseSlug = (storeRef || storeName).toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') || 'store'

  const normalizedEmail = String(email).trim().toLowerCase()
  const emailQuery = await db.collection('users').where('email', '==', normalizedEmail).get()
  if (!emailQuery.empty) throw new HttpsError('already-exists', 'البريد مسجل مسبقاً')

  // Reasonable trial-abuse prevention: one trial per identity. A phone number
  // already tied to a merchant/tenant blocks a second account. (Verified phone
  // OTP is Phase 2; this is not an aggressive fingerprinting system.)
  const normalizedPhone = phone ? String(phone).replace(/[^0-9]/g, '') : ''
  if (normalizedPhone && normalizedPhone.length >= 9) {
    const phoneQuery = await db.collection('users').where('phone', '==', normalizedPhone).limit(5).get()
    const conflicting = phoneQuery.docs.some((d) => d.data()?.role === 'merchant' || (d.data()?.storeIds || []).length > 0)
    if (conflicting) throw new HttpsError('already-exists', 'رقم الهاتف مستخدم مسبقاً')
  }

  // Ensure the storefront slug is unique — append a numeric suffix when a
  // store already claims the candidate slug.
  let slug = baseSlug
  let attempt = 1
  for (;;) {
    const slugQuery = await db.collection('stores').where('slug', '==', slug).limit(1).get()
    if (slugQuery.empty) break
    attempt += 1
    slug = `${baseSlug}-${attempt}`
  }

  const requestedPlanId = planId && planId !== 'pending' ? String(planId) : ''
  if (requestedPlanId === 'plan-lifetime') {
    throw new HttpsError('failed-precondition', 'شراء المتجر يتم من خلال طلب دفع معتمد بعد إنشاء المتجر')
  }
  // Enterprise is not a subscription plan — it is a contact flow only.
  if (requestedPlanId === 'enterprise' || requestedPlanId === 'plan-enterprise') {
    throw new HttpsError('failed-precondition', 'عروض Enterprise تتم عبر طلب عرض مخصص وليست اشتراكًا مباشرًا')
  }

  // Determine effective plan for the intro trial.
  // Free → 30 days, Starter/Growth/Pro → 3 days of that same plan's entitlements.
  let targetPlanId: string
  if (PUBLIC_PAID_PLAN_IDS.has(requestedPlanId)) {
    targetPlanId = requestedPlanId
  } else if (requestedPlanId === '' || requestedPlanId === 'pending') {
    targetPlanId = 'plan-basic'
  } else {
    throw new HttpsError('failed-precondition', 'الباقة المطلوبة غير متاحة للتسجيل الجديد')
  }

  const targetPlanSnap = await db.doc(`plans/${targetPlanId}`).get()
  if (!targetPlanSnap.exists || targetPlanSnap.data()?.active === false || targetPlanSnap.data()?.archived === true) {
    throw new HttpsError('failed-precondition', 'الباقة المطلوبة غير متاحة حالياً')
  }
  const canonicalTarget = CANONICAL_PLANS.find((candidate) => candidate.id === targetPlanId)!
  const plan = { ...targetPlanSnap.data(), ...canonicalTarget } as any
  const resolvedPlanId = targetPlanId
  const planName = plan.name || targetPlanId
  const cycle = 'monthly'
  const trialDays = Number(plan.trialDays) > 0 ? Number(plan.trialDays) : 3
  const registrationAt = new Date()
  const trialEndsAt = new Date(registrationAt.getTime() + trialDays * DAY_MS)
  const normalPriceSnapshot = Number(plan?.priceMonthly || 0)
  const launchEnabled = !!plan?.launchEnabled
  const launchPriceSnapshot = launchEnabled && Number(plan?.launchPrice) > 0 ? Number(plan.launchPrice) : normalPriceSnapshot
  const yearlyPriceSnapshot = Number(plan?.priceYearly || 0)
  const MB = 1024 * 1024
  const storageLimitBytes = Number(plan?.storageLimit || 0) * MB

  await db.doc(`users/${uid}`).set({
    uid,
    email: normalizedEmail,
    name,
    role: 'merchant',
    storeIds: [storeId],
    phone: normalizedPhone || null,
    active: true,
    merchantStatus: 'active',
    emailVerificationRequired: true,
    createdAt: now(),
    updatedAt: now(),
    createdBy: uid,
  })
  await db.doc(`stores/${storeId}`).set({
    ref: slug,
    name: storeName,
    slug,
    active: true,
    status: 'draft',
    storeStatus: 'draft',
    approvalStatus: 'active',
    published: false,
     ownerId: uid,
    currency: 'EGP',
    description: '',
    theme: { primary: '#6366f1', darkMode: false },
    storageUsed: 0,
    storageLimitBytes,
    createdAt: now(),
    updatedAt: now(),
    createdBy: uid,
  })
  const subDoc: Record<string, any> = {
    storeId,
    planId: resolvedPlanId,
    planName,
    status: 'trialing',
    billingCycle: cycle,
    trialDays,
    trialUsed: true,
    trialStatus: 'active',
    trialPlanId: resolvedPlanId,
    trialStartedAt: Timestamp.fromDate(registrationAt),
    trialEndsAt: Timestamp.fromDate(trialEndsAt),
    // Intro trial tracking — one trial per merchant/store only.
    initialTrialPlanId: resolvedPlanId,
    initialTrialStartedAt: Timestamp.fromDate(registrationAt),
    initialTrialEndsAt: Timestamp.fromDate(trialEndsAt),
    trialConsumed: false,
    periodNumber: 0,
    normalPriceSnapshot,
    launchPriceSnapshot,
    yearlyPriceSnapshot,
    ordersUsed: 0,
    createdAt: now(),
    updatedAt: now(),
    createdBy: uid,
    billingModel: 'subscription',
    ownershipType: 'subscription',
    lifetimeAccess: false,
    limitsSnapshot: {
      orderLimitPerMonth: Number(plan?.orderLimitPerMonth || 0),
      productLimit: Number(plan?.productLimit || 0),
      landingPagesLimit: Number(plan?.landingPagesLimit || 0),
      salesLinksLimit: Number(plan?.salesLinksLimit || 0),
      staffLimit: Number(plan?.staffLimit || 0),
      storageLimit: Number(plan?.storageLimit || 0),
      ...(typeof plan?.unlimitedProducts === 'boolean' ? { unlimitedProducts: plan.unlimitedProducts } : {}),
      ...(typeof plan?.unlimitedSalesLinks === 'boolean' ? { unlimitedSalesLinks: plan.unlimitedSalesLinks } : {}),
    },
    featuresSnapshot: Array.isArray(plan?.features) ? plan.features : [],
    featureFlagsSnapshot: Object.fromEntries(PLAN_FEATURE_KEYS.map((key) => [key, plan?.[key] === true])),
  }
  const subscriptionRef = db.collection('subscriptions').doc()
  await subscriptionRef.set(subDoc)
  await db.doc(`stores/${storeId}`).update({ activeSubscriptionId: subscriptionRef.id, updatedAt: now() })

  await auth.createUser({ uid, email: normalizedEmail, password, displayName: name, disabled: false })

  const isFreeTrial = resolvedPlanId === 'plan-free'
  await createBillingNotification(
    storeId,
    uid,
    isFreeTrial ? 'بدأ شهرك المجاني' : `بدأت تجربة ${planName} المجانية`,
    isFreeTrial
      ? 'لديك 30 يومًا لتشغيل متجرك على Free. بعد انتهائها تبقى بياناتك محفوظة ويلزم اختيار Starter أو Growth أو Pro لاستكمال العمليات.'
      : `لديك 3 أيام لتجربة ${planName} بكامل مزاياها. بعد انتهائها تحتاج إلى تفعيل نفس الباقة أو اختيار باقة أخرى مدفوعة للاستمرار.`,
  )
  await auditLog(
    storeId,
    uid,
    isFreeTrial ? 'free_trial_started_on_registration' : 'paid_trial_started_on_registration',
    'subscriptions',
    subscriptionRef.id,
    { planId: resolvedPlanId, trialDays, merchantStatus: 'active', initialTrialPlanId: resolvedPlanId },
  )

  return { uid, storeId, status: 'trialing', planId: resolvedPlanId, trialDays }
})

// ─────────────────────────────────────────────────────────────
// 4. approveSubscription — platform admin creates merchant login
// ─────────────────────────────────────────────────────────────
export const approveSubscription = onCall(async (request: CallableRequest<{ subscriptionId?: string }>) => {
  await assertPlatformAdmin(request)
  const { subscriptionId } = request.data || {}
  if (!subscriptionId) throw new HttpsError('invalid-argument', 'subscriptionId مطلوب')
  const result = await approveMerchantApplication(subscriptionId, request.auth!.uid)
  if (!result.alreadyApproved) {
    await createBillingNotification(result.storeId, result.store.ownerId, result.status === 'trialing' ? 'بدأت تجربتك المجانية' : 'تم اعتماد باقتك المجانية', result.status === 'trialing'
      ? `تم اعتماد حسابك وبدأت تجربة ${result.planName || 'الباقة'} لمدة 3 أيام.`
      : 'تم اعتماد حسابك على الباقة المجانية. يمكنك إعداد متجرك ثم نشره عند الجاهزية.')
    await auditLog(result.storeId, request.auth!.uid, 'approve_merchant_application', 'subscriptions', subscriptionId, { storeId: result.storeId, ownerId: result.store.ownerId, status: result.status })
  }
  return { ok: true, status: result.status, alreadyApproved: result.alreadyApproved }
})

// ─────────────────────────────────────────────────────────────
// 4b. rejectSubscription — platform admin denies a pending request
// ─────────────────────────────────────────────────────────────
export const rejectSubscription = onCall(async (request: CallableRequest<{ subscriptionId?: string }>) => {
  await assertPlatformAdmin(request)
  const { subscriptionId } = request.data || {}
  if (!subscriptionId) throw new HttpsError('invalid-argument', 'subscriptionId مطلوب')

  const subRef = db.doc(`subscriptions/${subscriptionId}`)
  const subSnap = await subRef.get()
  if (!subSnap.exists) throw new HttpsError('not-found', 'الاشتراك غير موجود')
  const sub = subSnap.data()!

  await subRef.update({
    status: 'rejected',
    approvedBy: request.auth!.uid,
    updatedAt: now(),
  })
  const rejectedStore = await db.doc(`stores/${sub.storeId}`).get()
  const rejectedOwnerId = rejectedStore.exists ? rejectedStore.data()?.ownerId : null
  if (rejectedOwnerId) {
    await db.doc(`users/${rejectedOwnerId}`).set({ active: false, merchantStatus: 'rejected', updatedAt: now() }, { merge: true })
  }

  await db.collection('notifications').add({
    storeId: sub.storeId,
    userId: null,
    title: 'تم رفض اشتراكك',
    body: 'لم يتم اعتماد طلب اشتراكك هذا. يمكنك التواصل مع إدارة المنصة للمزيد من التفاصيل.',
    type: 'billing',
    read: false,
    createdAt: now(),
    createdBy: 'system',
  })

  await auditLog(sub.storeId, request.auth!.uid, 'reject_subscription', 'subscriptions', subscriptionId, { storeId: sub.storeId })

  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// 4d. getMerchantSubscription — merchant resolves the live status of their
//     store's subscription (with plan + payment history) for the dashboard
//     and subscription page. Server-computed status, never the raw doc.
// ─────────────────────────────────────────────────────────────
export const getMerchantSubscription = onCall(async (request: CallableRequest<{ storeId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId } = request.data || {}
  if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')
  await assertStoreAccess(request, storeId)

  const userSnap = await db.doc(`users/${request.auth.uid}`).get()
  const user = userSnap.data()
  if (user?.role !== 'merchant' && user?.role !== 'superAdmin') {
    throw new HttpsError('permission-denied', 'صلاحيات غير كافية')
  }

  const entry = await latestSubscriptionForStore(storeId)
  if (!entry) return { subscription: null, plan: null, paymentRequests: [], changeRequests: [], purchaseRequests: [], resourceUsage: null, status: 'none' }

  let status = resolveSubscriptionStatus(entry.data)
  if (status === 'expired' && entry.data.status !== 'expired') {
    await expireSubscriptionLazily(storeId, entry.id, entry.data, request.auth.uid).catch(() => {})
    status = 'expired'
  }

  let plan: any = null
  try {
    const planSnap = await db.doc(`plans/${entry.data.planId}`).get()
    plan = planSnap.exists ? { id: planSnap.id, ...effectivePlanForSubscription(entry.data, planSnap.data()) } : null
  } catch {
    plan = null
  }

  const paySnap = await db.collection('subscriptionPayments')
    .where('subscriptionId', '==', entry.id)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get()
  // The Firestore document id is authoritative. Legacy/local fixtures may
  // contain an embedded id field, which must never override the real key.
  const paymentRequests = paySnap.docs.map((d) => ({ ...d.data(), id: d.id }))
  const changeSnap = await db.collection('subscriptionChangeRequests')
    .where('storeId', '==', storeId)
    .limit(20)
    .get()
  const changeRequests = changeSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0))
  const purchaseSnap = await db.collection('storePurchaseRequests')
    .where('storeId', '==', storeId)
    .limit(20)
    .get()
  const purchaseRequests = purchaseSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0))

  const storeSnap = await db.doc(`stores/${storeId}`).get().catch(() => null)
  const store = storeSnap?.exists ? storeSnap.data()! : null

  const resourceUsage = store ? await merchantResourceUsage(storeId, entry.data, plan, store) : null
  return { subscription: { id: entry.id, ...entry.data }, plan, paymentRequests, changeRequests, purchaseRequests, resourceUsage, status, store: store ? { id: storeId, storageUsed: Number(store.storageUsed || 0), storageLimitBytes: Number(store.storageLimitBytes || 0) } : null }
})

// ─────────────────────────────────────────────────────────────
// 4d2+. changeSubscriptionPlan — merchant requests a plan change.  This
// endpoint deliberately never mutates the granting subscription.  It creates a
// server-quoted change request; the merchant must submit proof and a platform
// admin must approve the resulting payment before entitlements change.
// ─────────────────────────────────────────────────────────────
export const changeSubscriptionPlan = onCall(async (request: CallableRequest<{ storeId?: string; planId?: string; billingCycle?: 'monthly' | 'yearly' }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, planId, billingCycle } = request.data || {}
  if (!storeId || !planId) throw new HttpsError('invalid-argument', 'storeId و planId مطلوبان')
  const rawChange = request.data as Record<string, unknown> | undefined
  if (rawChange && ['amount', 'status', 'expiresAt', 'limits', 'features', 'price'].some((field) => field in rawChange)) {
    throw new HttpsError('invalid-argument', 'السعر والحالة والحدود تُحدد من الخادم')
  }
  await assertStoreAccess(request, storeId, 'billing:edit')

  const caller = await db.doc(`users/${request.auth.uid}`).get()
  if (caller.data()?.role !== 'merchant') {
    throw new HttpsError('permission-denied', 'طلبات تغيير الباقة متاحة لمالك المتجر فقط')
  }

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) throw new HttpsError('not-found', 'المتجر غير موجود')

  if (!PUBLIC_PAID_PLAN_IDS.has(planId)) {
    throw new HttpsError('not-found', 'الباقة المطلوبة غير متاحة للإطلاق الحالي')
  }

  const planSnap = await db.doc(`plans/${planId}`).get()
  if (!planSnap.exists || !planSnap.data()?.active || planSnap.data()?.isPurchasable === false || planSnap.data()?.archived === true) {
    throw new HttpsError('not-found', 'الباقة المطلوبة غير متاحة')
  }
  if (planSnap.data()?.billingModel === 'one_time') {
    throw new HttpsError('failed-precondition', 'استخدم مسار شراء المتجر لمرة واحدة')
  }

  // Billing remains available after a trial expires. Operational grants are
  // intentionally stricter, but expiry must never dead-end the upgrade path.
  const entry = await latestSubscriptionForStore(storeId)
  if (!entry) throw new HttpsError('failed-precondition', 'لا يوجد اشتراك حالي لهذا المتجر.')
  const currentStatus = resolveSubscriptionStatus(entry.data)
  if (!['active', 'trialing', 'expired', 'suspended'].includes(currentStatus)) {
    throw new HttpsError('failed-precondition', 'حالة الاشتراك الحالية لا تسمح بطلب الترقية')
  }
  if (entry.data.planId === planId) return { ok: true, changed: false, planId }
  const currentPlanSnap = await db.doc(`plans/${entry.data.planId}`).get()
  const currentPlan = currentPlanSnap.exists ? effectivePlanForSubscription(entry.data, currentPlanSnap.data()) : { name: entry.data.planName || entry.data.planId }

  const canonicalPlan = CANONICAL_PLANS.find((candidate) => candidate.id === planId)
  const newPlan = { ...planSnap.data(), ...(canonicalPlan || {}) } as any
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly'
  const quotedAmount = cycle === 'yearly'
    ? Number(newPlan?.priceYearly || newPlan?.priceMonthly || 0)
    : Number(newPlan?.priceMonthly || 0)
  if (!Number.isFinite(quotedAmount) || quotedAmount <= 0) {
    throw new HttpsError('failed-precondition', 'لا يمكن طلب تغيير إلى باقة مجانية من هذا المسار')
  }

  // Apply at most one server-authoritative plan promotion. The client cannot
  // supply a discount or promotional amount; eligibility is resolved here.
  let promotionSnapshot: any = null
  const promoSnap = await db.collection('platformPromotions').where('type', '==', 'plan_offer').get()
  for (const pd of promoSnap.docs) {
    const p = pd.data() as any
    if (promotionState(p) !== 'active' || p.planId !== planId) continue
    if (p.audienceType === 'selected_merchants' && !(p.targetMerchantIds || []).includes(request.auth.uid)) continue
    const candidate = Number(p.promotionalPrice)
    if (!Number.isFinite(candidate) || candidate < 0 || candidate >= quotedAmount) continue
    promotionSnapshot = { promotionId: pd.id, promotionTitle: p.title || '', regularPrice: quotedAmount, discountAmount: quotedAmount - candidate, promotionalPrice: candidate, promotionEndsAt: p.endsAt || null }
    break
  }
  const finalAmount = promotionSnapshot ? promotionSnapshot.promotionalPrice : quotedAmount

  const ref = db.collection('subscriptionChangeRequests').doc()
  const planSnapshot = {
    planId,
    planName: newPlan?.name || planId,
    priceMonthly: Number(newPlan?.priceMonthly || 0),
    priceYearly: Number(newPlan?.priceYearly || 0),
    orderLimitPerMonth: Number(newPlan?.orderLimitPerMonth || 0),
    productLimit: Number(newPlan?.productLimit || 0),
    landingPagesLimit: Number(newPlan?.landingPagesLimit || 0),
    salesLinksLimit: Number(newPlan?.salesLinksLimit || 0),
    staffLimit: Number(newPlan?.staffLimit || 0),
    storageLimit: Number(newPlan?.storageLimit || 0),
    ...(typeof newPlan?.unlimitedProducts === 'boolean' ? { unlimitedProducts: newPlan.unlimitedProducts } : {}),
    ...(typeof newPlan?.unlimitedSalesLinks === 'boolean' ? { unlimitedSalesLinks: newPlan.unlimitedSalesLinks } : {}),
    features: Array.isArray(newPlan?.features) ? newPlan.features : [],
    featureFlags: {
      quantityPricing: newPlan?.quantityPricing === true,
      variantInventory: newPlan?.variantInventory === true,
    coupons: newPlan?.coupons === true,
    analytics: newPlan?.analytics !== false,
    whatsappAutomation: newPlan?.whatsappAutomation === true,
    },
  }
  let duplicate: any = null
  await db.runTransaction(async (tx) => {
    const currentSub = await tx.get(db.doc(`subscriptions/${entry.id}`))
    if (!currentSub.exists || currentSub.data()?.planId !== entry.data.planId) {
      throw new HttpsError('aborted', 'تغير الاشتراك أثناء إنشاء الطلب، حاول مرة أخرى')
    }
    const currentRequestId = currentSub.data()?.activeChangeRequestId
    if (currentRequestId) {
      const currentRequest = await tx.get(db.doc(`subscriptionChangeRequests/${currentRequestId}`))
      if (currentRequest.exists && ['pending_payment', 'pending_approval'].includes(String(currentRequest.data()?.status))) {
        duplicate = { id: currentRequest.id, data: currentRequest.data() }
        return
      }
    }
    tx.create(ref, {
      id: ref.id,
      storeId,
      subscriptionId: entry.id,
      fromPlanId: entry.data.planId,
      fromPlanName: currentPlan?.name || entry.data.planId,
      toPlanId: planId,
      toPlanName: newPlan?.name || planId,
      billingCycle: cycle,
      quotedAmount: finalAmount,
      regularPrice: quotedAmount,
      ...(promotionSnapshot || {}),
      currency: storeSnap.data()?.currency || 'EGP',
      planSnapshot,
      status: 'pending_payment',
      requestedAt: now(),
      requestedBy: request.auth!.uid,
      createdAt: now(),
      updatedAt: now(),
    })
    tx.update(db.doc(`subscriptions/${entry.id}`), { activeChangeRequestId: ref.id, updatedAt: now() })
  })
  if (duplicate) return { ok: true, changed: false, requestId: duplicate.id, status: duplicate.data?.status, quotedAmount: duplicate.data?.quotedAmount }
  await auditLog(storeId, request.auth.uid, 'subscription_change_requested', 'subscriptionChangeRequests', ref.id, { fromPlanId: entry.data.planId, toPlanId: planId, quotedAmount: finalAmount, regularPrice: quotedAmount, promotionId: promotionSnapshot?.promotionId || null })
  return { ok: true, changed: false, requestId: ref.id, status: 'pending_payment', quotedAmount: finalAmount, regularPrice: quotedAmount, promotion: promotionSnapshot }
})

// ─────────────────────────────────────────────────────────────
// 4d3. checkStorageQuota — authoritative storage usage check (server-side
//      truth). Reads the `storageUsed` counter (maintained by the Storage
//      triggers) and compares against the plan limit; returns a safe summary
//      for the UI meter + product raiser pre-checks.
// ─────────────────────────────────────────────────────────────
export const checkStorageQuota = onCall(async (request: CallableRequest<{ storeId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId } = request.data || {}
  if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')
  await assertStoreAccess(request, storeId, 'billing:view')

  const grant = await grantForStore(storeId, request.auth.uid)
  const MB = 1024 * 1024
  const limitBytes = grant ? Number(grant.plan?.storageLimit || 0) * MB : 0

  // Authoritative usage comes from the `storageUsed` counter maintained by the
  // Storage finalize/delete triggers — no full-bucket listing required.
  const usedBytes = await db
    .doc(`stores/${storeId}`)
    .get()
    .then((s) => Number(s.exists ? s.data()?.storageUsed || 0 : 0))
    .catch(() => 0)

  const limitReached = limitBytes > 0 && usedBytes >= limitBytes
  const remainingBytes = limitBytes > 0 ? Math.max(0, limitBytes - usedBytes) : null
  return {
    usedBytes,
    limitBytes,
    limitReached,
    remainingBytes,
    usedPercent: limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0,
  }
})

/**
 * Reliable fallback for merchant image uploads.  Direct Storage SDK uploads
 * are preferred (with resumable progress), but a stale Storage entitlement
 * rule must never leave a paid merchant unable to brand the store or add a
 * product.  This callable uses the same server-side subscription and tenancy
 * checks used by the rest of the merchant workspace.
 */
export const uploadMerchantImage = onCall(async (request: CallableRequest<{
  storeId?: string
  assetType?: 'product' | 'store' | 'landing'
  productId?: string
  fileName?: string
  contentType?: string
  base64?: string
}>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, assetType, productId, fileName, contentType, base64 } = request.data || {}
  if (!storeId || !['product', 'store', 'landing'].includes(String(assetType))) throw new HttpsError('invalid-argument', 'بيانات رفع الصورة غير مكتملة')
  const mime = String(contentType || '').toLowerCase()
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) throw new HttpsError('invalid-argument', 'صيغة الصورة غير مدعومة')
  const encoded = String(base64 || '').replace(/^data:[^;]+;base64,/, '')
  if (!encoded || !/^[A-Za-z0-9+/=]+$/.test(encoded)) throw new HttpsError('invalid-argument', 'ملف الصورة غير صالح')
  const bytes = Buffer.from(encoded, 'base64')
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new HttpsError('invalid-argument', 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت')
  const permission = assetType === 'product' ? 'products:edit' : assetType === 'landing' ? 'landing:manage' : 'settings:edit'
  await assertStoreAccess(request, String(storeId), permission)
  const grant = await grantForStore(String(storeId), request.auth.uid)
  if (!grant) throw new HttpsError('failed-precondition', 'تحتاج إلى باقة نشطة لرفع الصور')
  const storeSnap = await db.doc(`stores/${storeId}`).get()
  const used = Number(storeSnap.data()?.storageUsed || 0)
  const limit = Number(grant.plan?.storageLimit || 0) * 1024 * 1024
  if (limit > 0 && used + bytes.length > limit) throw new HttpsError('resource-exhausted', 'وصلت إلى حد التخزين في باقتك')
  const extension = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'gif'
  const clean = String(fileName || 'image').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'image'
  const stamp = `${Date.now()}-${randomBytes(5).toString('hex')}-${clean}.${extension}`
  const path = assetType === 'product'
    ? `stores/${storeId}/products/${String(productId || '').trim()}/${stamp}`
    : assetType === 'landing' ? `landingPages/${storeId}/${stamp}` : `stores/${storeId}/${stamp}`
  if (assetType === 'product' && !String(productId || '').trim()) throw new HttpsError('invalid-argument', 'معرف المنتج مطلوب')
  const token = randomBytes(20).toString('hex')
  await admin.storage().bucket(STORAGE_BUCKET).file(path).save(bytes, {
    resumable: false,
    metadata: { contentType: mime, metadata: { storeId: String(storeId), firebaseStorageDownloadTokens: token } },
  })
  const bucket = encodeURIComponent(STORAGE_BUCKET)
  return { ok: true, path, url: `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}` }
})

// ─────────────────────────────────────────────────────────────
// 4d3a. getBillingSnapshots — immutable, editable-history billing trail for a
//       store (activation / plan changes / manual edits). Merchants can review
//       exactly what plan + price + limits were in effect at each moment.
// ─────────────────────────────────────────────────────────────
export const getBillingSnapshots = onCall(async (request: CallableRequest<{ storeId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId } = request.data || {}
  if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')
  await assertStoreAccess(request, storeId, 'billing:view')

  const snaps = await db
    .collection(`stores/${storeId}/billingSnapshots`)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  return {
    snapshots: snaps.docs.map((d) => ({ id: d.id, ...d.data() })),
  }
})

// ─────────────────────────────────────────────────────────────
// 4d3b. Storage triggers — maintain the per-store `storageUsed` counter
//       atomically and enforce the plan storage quota server-side.
//
// The client uploads via the Storage SDK (gated by storage.rules for
// tenancy + file size/type). These triggers are the SOURCE OF TRUTH for the
// counter: on finalize we increment, and reject (delete) the object when it
// would exceed the merchant's plan quota; on delete we release the bytes.
// `checkStorageQuota` reads this counter instead of listing the whole bucket.
// ─────────────────────────────────────────────────────────────
function storeIdFromObjectName(name: string): string | null {
  // Uploaded prefixes: stores/{storeId}/..., landingPages/{storeId}/...,
  // documents/{storeId}/... (see src/shared/services/uploads.ts).
  const m = name.match(/^(stores|landingPages|documents)\/([^/]+)\//)
  return m ? m[2] : null
}

export const onStorageFinalize = onObjectFinalized({ bucket: STORAGE_BUCKET }, async (event) => {
  const name = event.data.name
  const size = Number((event.data as any)?.size || 0)
  const storeId = storeIdFromObjectName(name)
  if (!storeId || size <= 0) return
  const storeRef = db.doc(`stores/${storeId}`)
  const snap = await storeRef.get()
  if (!snap.exists) return
  const data = snap.data()!
  const limit = Number(data?.storageLimitBytes || 0)
  // Enforce the plan quota: reject (delete) objects that would push usage over.
  if (limit > 0) {
    const used = Number(data?.storageUsed || 0)
    if (used + size > limit) {
      try {
        await admin.storage().bucket(event.data.bucket).file(name).delete()
      } catch {
        /* object may already be gone */
      }
      return
    }
  }
  await storeRef.update({ storageUsed: FieldValue.increment(size), updatedAt: now() })
})

export const onStorageDelete = onObjectDeleted({ bucket: STORAGE_BUCKET }, async (event) => {
  const name = event.data.name
  const size = Number((event.data as any)?.size || 0)
  const storeId = storeIdFromObjectName(name)
  if (!storeId || size <= 0) return
  const storeRef = db.doc(`stores/${storeId}`)
  // Release the bytes, never letting the counter drop below zero.
  await db.runTransaction(async (tx) => {
    const s = await tx.get(storeRef)
    if (!s.exists) return
    const used = Number(s.data()?.storageUsed || 0)
    tx.update(storeRef, { storageUsed: Math.max(0, used - size), updatedAt: now() })
  }).catch(() => {})
})

// ─────────────────────────────────────────────────────────────
// 4d2. getMerchantPaymentInfo — payments instructions/currency for merchants.
//      The `settings/platform` doc is admin-only in Firestore rules; this
//      callable exposes ONLY the safe, publicly-visible payment fields to any
//      signed-in user (merchants need them to activate a subscription). It can
//      never modify settings — writes remain platform-admin only.
// ─────────────────────────────────────────────────────────────
export const getMerchantPaymentInfo = onCall(async (request: CallableRequest) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')

  const caller = await db.doc(`users/${request.auth.uid}`).get()
  const role = caller.exists ? caller.data()?.role : null
  if (role !== 'merchant' && role !== 'superAdmin') {
    throw new HttpsError('permission-denied', 'بيانات الدفع متاحة للتجار فقط')
  }

  const snap = await db.doc('settings/platform').get().catch(() => null)
  const data = snap?.exists ? snap.data() : {}
  return {
    paymentInstructions: typeof data?.paymentInstructions === 'string' ? data.paymentInstructions : '',
    paymentContact: typeof data?.paymentContact === 'string' ? data.paymentContact : '',
    currency: typeof data?.currency === 'string' ? data.currency : 'EGP',
  }
})

// Public-safe Enterprise contact projection. It deliberately returns only the
// three fields needed by the landing CTA; all other platform settings remain
// admin-only.
export const getPublicPlatformConfig = onCall(async (_request: CallableRequest) => {
  const snap = await db.doc('settings/platform').get().catch(() => null)
  return safeEnterpriseWhatsAppConfig(snap?.exists ? snap.data() : {})
})

export const saveEnterpriseWhatsAppSettings = onCall(async (request: CallableRequest<{ number?: string; enabled?: boolean; message?: string }>) => {
  await assertPlatformAdmin(request)
  const raw = request.data || {}
  const number = normalizeEnterpriseWhatsAppNumber(raw.number)
  const enabled = raw.enabled === true
  if (enabled && !number) throw new HttpsError('invalid-argument', 'أدخل رقم واتساب بصيغة دولية صحيحة قبل التفعيل')
  const message = typeof raw.message === 'string' && raw.message.trim()
    ? raw.message.trim().slice(0, 500)
    : DEFAULT_ENTERPRISE_WHATSAPP_MESSAGE
  const patch = {
    enterpriseWhatsAppNumber: number,
    enterpriseWhatsAppEnabled: enabled && Boolean(number),
    enterpriseWhatsAppMessage: message,
    updatedAt: now(),
    updatedBy: request.auth!.uid,
  }
  await db.doc('settings/platform').set(patch, { merge: true })
  return safeEnterpriseWhatsAppConfig(patch)
})

/** Stores only non-sensitive WhatsApp automation preferences. Meta access tokens
 * are intentionally not accepted from the browser and will be configured as a
 * server secret when the business number is ready. */
export const saveWhatsAppAutomationSettings = onCall(async (request: CallableRequest<{ senderNumber?: string; events?: string[]; templates?: Record<string, string>; metaTemplates?: Record<string, MetaWhatsAppTemplate> }>) => {
  await assertPlatformAdmin(request)
  const raw = request.data || {}
  const senderNumber = normalizeEnterpriseWhatsAppNumber(raw.senderNumber)
  const events = Array.isArray(raw.events)
    ? raw.events.filter((event): event is typeof WHATSAPP_AUTOMATION_EVENTS[number] => WHATSAPP_AUTOMATION_EVENTS.includes(String(event) as typeof WHATSAPP_AUTOMATION_EVENTS[number]))
    : [...WHATSAPP_AUTOMATION_EVENTS]
  const templates = Object.fromEntries(WHATSAPP_AUTOMATION_EVENTS.map((event) => [event, typeof raw.templates?.[event] === 'string' && raw.templates[event].trim() ? raw.templates[event].trim().slice(0, 1200) : DEFAULT_WHATSAPP_TEMPLATES[event]]))
  const metaTemplates = Object.fromEntries(WHATSAPP_AUTOMATION_EVENTS.map((event) => [event, normalizeMetaWhatsAppTemplate(raw.metaTemplates?.[event])]))
  const patch = { whatsappAutomation: { senderNumber, events: events.length ? events : [...WHATSAPP_AUTOMATION_EVENTS], templates, metaTemplates }, updatedAt: now(), updatedBy: request.auth!.uid }
  await db.doc('settings/platform').set(patch, { merge: true })
  return safeWhatsAppAutomationConfig(patch)
})

export const getStoreWhatsAppAutomation = onCall(async (request: CallableRequest<{ storeId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = String(request.data?.storeId || '').trim()
  if (!storeId) throw new HttpsError('invalid-argument', 'معرف المتجر مطلوب')
  await assertStoreAccess(request, storeId, 'settings:view')
  const grant = await grantForStore(storeId, request.auth.uid)
  if (!grant || !canUseFeature(grant.plan, 'whatsappAutomation')) throw new HttpsError('resource-exhausted', 'أتمتة واتساب متاحة في باقات GROWTH وما فوق')
  const snap = await db.doc(`storeWhatsAppAutomation/${storeId}`).get()
  return safeWhatsAppAutomationConfig(snap.exists ? snap.data() || {} : {})
})

export const saveStoreWhatsAppMetaConnection = onCall({ region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey] }, async (request: CallableRequest<{ storeId?: string; phoneNumberId?: string; accessToken?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = String(request.data?.storeId || '').trim()
  const phoneNumberId = String(request.data?.phoneNumberId || '').trim()
  const accessToken = String(request.data?.accessToken || '').trim()
  if (!storeId || !/^\d{5,30}$/.test(phoneNumberId) || accessToken.length < 20 || accessToken.length > 4096) {
    throw new HttpsError('invalid-argument', 'أدخل Phone Number ID وتوكن Meta صالحين')
  }
  await assertStoreAccess(request, storeId, 'settings:edit')
  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists) throw new HttpsError('not-found', 'المتجر غير موجود')
  const provider = 'meta'
  const ref = db.doc(`integrationCredentials/${credentialDocumentId(storeId, 'whatsapp', provider)}`)
  const existing = await ref.get()
  const keyVersion = Math.max(1, Number(existing.data()?.keyVersion || 0) + 1)
  const credentials = { phoneNumberId, accessToken }
  const envelope = encryptCredentials(credentials, { storeId, provider, integrationType: 'whatsapp', keyVersion })
  await ref.set({
    id: ref.id, storeId, merchantId: storeSnap.data()?.ownerId || request.auth.uid,
    provider, integrationType: 'whatsapp', envelope, keyVersion,
    maskedCredentials: { phoneNumberId: credentialSummary({ phoneNumberId }).phoneNumberId, accessToken: credentialSummary({ accessToken }).accessToken },
    status: 'CONFIGURED', createdAt: existing.exists ? existing.data()?.createdAt : now(), updatedAt: now(),
    createdBy: existing.exists ? existing.data()?.createdBy : request.auth.uid, updatedBy: request.auth.uid,
    lastValidatedAt: null, lastValidationStatus: null,
  }, { merge: true })
  await db.doc(`storeWhatsAppAutomation/${storeId}`).set({
    id: storeId, storeId, metaPhoneNumberIdMasked: String(credentialSummary({ phoneNumberId }).phoneNumberId || ''),
    metaConnectionStatus: 'CONFIGURED', metaConnectionVerifiedAt: null, updatedAt: now(), updatedBy: request.auth.uid,
  }, { merge: true })
  return { ok: true, status: 'CONFIGURED', phoneNumberIdMasked: credentialSummary({ phoneNumberId }).phoneNumberId }
})

export const testStoreWhatsAppMetaConnection = onCall({ region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey] }, async (request: CallableRequest<{ storeId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = String(request.data?.storeId || '').trim()
  if (!storeId) throw new HttpsError('invalid-argument', 'معرف المتجر مطلوب')
  await assertStoreAccess(request, storeId, 'settings:edit')
  let vault: Awaited<ReturnType<typeof loadIntegrationCredentials>>
  try { vault = await loadIntegrationCredentials(db, storeId, 'whatsapp', 'meta') }
  catch { throw new HttpsError('failed-precondition', 'بيانات Meta غير قابلة للقراءة؛ احفظها من جديد') }
  if (!vault) throw new HttpsError('failed-precondition', 'احفظ بيانات Meta أولاً')
  const phoneNumberId = String(vault.credentials.phoneNumberId || '')
  const accessToken = String(vault.credentials.accessToken || '')
  try {
    const response = await fetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(12_000),
    })
    const body = await response.json().catch(() => ({})) as Record<string, any>
    if (!response.ok || !body.id) throw new Error(String(body?.error?.message || `Meta returned ${response.status}`))
    await Promise.all([
      vault.ref.set({ status: 'CONNECTED', lastValidatedAt: now(), lastValidationStatus: 'CONNECTED', updatedAt: now() }, { merge: true }),
      db.doc(`storeWhatsAppAutomation/${storeId}`).set({ metaConnectionStatus: 'CONNECTED', metaConnectionVerifiedAt: now(), updatedAt: now(), metaDisplayNumber: String(body.display_phone_number || ''), metaVerifiedName: String(body.verified_name || '') }, { merge: true }),
    ])
    return { ok: true, status: 'CONNECTED', displayPhoneNumber: String(body.display_phone_number || ''), verifiedName: String(body.verified_name || '') }
  } catch (error) {
    const message = sanitizeSensitiveText(error instanceof Error ? error.message : 'تعذر الاتصال بـ Meta', [accessToken])
    await Promise.all([
      vault.ref.set({ status: 'ERROR', lastValidatedAt: now(), lastValidationStatus: 'ERROR', updatedAt: now() }, { merge: true }),
      db.doc(`storeWhatsAppAutomation/${storeId}`).set({ metaConnectionStatus: 'ERROR', metaConnectionVerifiedAt: null, updatedAt: now() }, { merge: true }),
    ])
    throw new HttpsError('failed-precondition', message)
  }
})

export const getStoreWhatsAppDeliveryLog = onCall(async (request: CallableRequest<{ storeId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = String(request.data?.storeId || '').trim()
  if (!storeId) throw new HttpsError('invalid-argument', 'معرف المتجر مطلوب')
  await assertStoreAccess(request, storeId, 'settings:view')
  const grant = await grantForStore(storeId, request.auth.uid)
  if (!grant || !canUseFeature(grant.plan, 'whatsappAutomation')) throw new HttpsError('resource-exhausted', 'أتمتة واتساب متاحة في باقات GROWTH وما فوق')
  const snap = await db.collection('whatsappDeliveries').where('storeId', '==', storeId).orderBy('createdAt', 'desc').limit(12).get()
  return { deliveries: snap.docs.map((doc) => {
    const value = doc.data() || {}
    return { id: doc.id, eventType: String(value.eventType || ''), orderNumber: String(value.orderNumber || ''), recipientPhoneMasked: String(value.recipientPhoneMasked || ''), deliveryStatus: String(value.deliveryStatus || ''), reason: value.reason ? String(value.reason) : null, createdAt: value.createdAt || null }
  }) }
})

/** Stores the merchant's non-sensitive WhatsApp preferences. API credentials
 * are configured server-side only once the merchant has a verified Meta number. */
export const saveStoreWhatsAppAutomation = onCall(async (request: CallableRequest<{ storeId?: string; senderNumber?: string; events?: string[]; templates?: Record<string, string>; metaTemplates?: Record<string, MetaWhatsAppTemplate> }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = String(request.data?.storeId || '').trim()
  if (!storeId) throw new HttpsError('invalid-argument', 'معرف المتجر مطلوب')
  await assertStoreAccess(request, storeId, 'settings:edit')
  const grant = await grantForStore(storeId, request.auth.uid)
  if (!grant || !canUseFeature(grant.plan, 'whatsappAutomation')) throw new HttpsError('resource-exhausted', 'أتمتة واتساب متاحة في باقات GROWTH وما فوق')
  const raw = request.data || {}
  const senderNumber = normalizeEnterpriseWhatsAppNumber(raw.senderNumber)
  const events = Array.isArray(raw.events)
    ? raw.events.filter((event): event is typeof WHATSAPP_AUTOMATION_EVENTS[number] => WHATSAPP_AUTOMATION_EVENTS.includes(String(event) as typeof WHATSAPP_AUTOMATION_EVENTS[number]))
    : [...WHATSAPP_AUTOMATION_EVENTS]
  const templates = Object.fromEntries(WHATSAPP_AUTOMATION_EVENTS.map((event) => [event, typeof raw.templates?.[event] === 'string' && raw.templates[event].trim() ? raw.templates[event].trim().slice(0, 1200) : DEFAULT_WHATSAPP_TEMPLATES[event]]))
  const metaTemplates = Object.fromEntries(WHATSAPP_AUTOMATION_EVENTS.map((event) => [event, normalizeMetaWhatsAppTemplate(raw.metaTemplates?.[event])]))
  const ref = db.doc(`storeWhatsAppAutomation/${storeId}`)
  const existing = await ref.get()
  const patch = { id: storeId, storeId, senderNumber, events: events.length ? events : [...WHATSAPP_AUTOMATION_EVENTS], templates, metaTemplates, createdAt: existing.exists ? existing.data()?.createdAt || now() : now(), updatedAt: now(), updatedBy: request.auth.uid }
  await ref.set(patch, { merge: true })
  return safeWhatsAppAutomationConfig(patch)
})

// One-time store ownership request. This only creates a quoted, pending
// request; it never changes the current subscription or entitlement.
export const requestStorePurchase = onCall(async (request: CallableRequest<{ storeId?: string; offerId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, offerId } = request.data || {}
  if (!storeId || !offerId) throw new HttpsError('invalid-argument', 'المتجر والعرض مطلوبان')
  await assertStoreAccess(request, storeId, 'billing:edit')
  const userSnap = await db.doc(`users/${request.auth.uid}`).get()
  const user = userSnap.data()
  if (!user || user.role !== 'merchant' || !(user.storeIds || []).includes(storeId)) {
    throw new HttpsError('permission-denied', 'صلاحيات غير كافية')
  }
  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists) throw new HttpsError('not-found', 'المتجر غير موجود')
  const entry = await latestSubscriptionForStore(storeId)
  if (!entry) throw new HttpsError('failed-precondition', 'لا يوجد اشتراك حالي')
  if (entry.data?.billingModel === 'one_time' && entry.data?.lifetimeAccess === true) {
    throw new HttpsError('already-exists', 'المتجر مملوك بالفعل')
  }
  const offerSnap = await db.doc(`plans/${offerId}`).get()
  if (!offerSnap.exists) throw new HttpsError('not-found', 'عرض الشراء غير موجود')
  const offer = offerSnap.data()!
  const amount = Number(offer.billingModel === 'one_time' ? offer.oneTimePrice : 0)
  const launchEndsAt = offer.launchOfferEndsAt || offer.launchExpiresAt || null
  const launchEnded = launchEndsAt && typeof launchEndsAt.toMillis === 'function'
    ? launchEndsAt.toMillis() <= Date.now()
    : launchEndsAt && typeof launchEndsAt.seconds === 'number'
      ? launchEndsAt.seconds * 1000 <= Date.now()
      : launchEndsAt && new Date(launchEndsAt).getTime() <= Date.now()
  if (offer.active === false || offer.archived === true || offer.isPurchasable === false || offer.billingModel !== 'one_time' || offer.isLaunchOffer === false || !Number.isFinite(amount) || amount <= 0 || offer.isPubliclyAvailable === false || launchEnded) {
    throw new HttpsError('failed-precondition', 'عرض الشراء غير متاح حالياً')
  }
  const pending = await db.collection('storePurchaseRequests')
    .where('storeId', '==', storeId)
    .where('status', 'in', ['pending_payment', 'pending_approval'])
    .limit(1)
    .get()
  if (!pending.empty) throw new HttpsError('already-exists', 'يوجد طلب شراء قيد المراجعة بالفعل')

  const offerRef = db.doc(`plans/${offerSnap.id}`)
  const launchLimit = Number(offer.launchOfferLimit || 0)
  const launchSlotReserved = launchLimit > 0
  const requestData = {
    id: '',
    storeId,
    merchantId: request.auth.uid,
    subscriptionId: entry.id,
    offerId: offerSnap.id,
    billingModel: 'one_time',
    quotedAmount: amount,
    currency: '',
    status: 'pending_payment',
    previousBillingModel: entry.data?.billingModel || 'subscription',
    previousPlanId: entry.data?.planId || null,
    previousPlanName: entry.data?.planName || null,
    launchOfferSlotReserved: launchSlotReserved,
    requestedAt: now(),
    createdAt: now(),
    updatedAt: now(),
    offerSnapshot: {},
  }
  const offerSnapshot = {
    id: offerSnap.id,
    name: String(offer.name || offerSnap.id),
    billingModel: 'one_time',
    oneTimePrice: amount,
    currency: String(storeSnap.data()?.currency || 'EGP'),
    productLimit: Number(offer.productLimit || 0),
    orderLimitPerMonth: Number(offer.orderLimitPerMonth || 0),
    landingPagesLimit: Number(offer.landingPagesLimit || 0),
    salesLinksLimit: Number(offer.salesLinksLimit || 0),
    staffLimit: Number(offer.staffLimit || 0),
    storageLimit: Number(offer.storageLimit || 0),
    unlimitedProducts: offer.unlimitedProducts === true,
    unlimitedSalesLinks: offer.unlimitedSalesLinks === true,
    features: Array.isArray(offer.features) ? offer.features : [],
    featureFlags: Object.fromEntries(PLAN_FEATURE_KEYS.map((key) => [key, offer[key] === true])),
  }
  const ref = db.collection('storePurchaseRequests').doc()
  const data = { ...requestData, id: ref.id, currency: offerSnapshot.currency, offerSnapshot }
  if (launchSlotReserved) {
    await db.runTransaction(async (tx) => {
      const currentOffer = await tx.get(offerRef)
      const current = currentOffer.data() || {}
      const currentLimit = Number(current.launchOfferLimit || 0)
      const sold = Number(current.launchOfferSoldCount || 0)
      if (current.isPubliclyAvailable === false || (currentLimit > 0 && sold >= currentLimit)) {
        throw new HttpsError('resource-exhausted', 'اكتمل عدد مقاعد عرض الإطلاق المتاحة')
      }
      tx.update(offerRef, { launchOfferSoldCount: sold + 1, updatedAt: now() })
      tx.create(ref, data)
    })
  } else {
    await ref.set(data)
  }
  await auditLog(storeId, request.auth.uid, 'one_time_purchase_requested', 'storePurchaseRequests', ref.id, { offerId: offerSnap.id, amount })
  return { ok: true, requestId: ref.id, quotedAmount: amount, currency: offerSnapshot.currency, status: 'pending_payment' }
})

// ─────────────────────────────────────────────────────────────
// 4e. submitPaymentRequest — merchant submits a manual payment/activation
//     request. The amount is computed server-side from price snapshots:
//     first paid month = launch price, renewals = normal price. Never trust
//     a client-supplied amount or plan.
// ─────────────────────────────────────────────────────────────
export const submitPaymentRequest = onCall(async (request: CallableRequest<{ subscriptionId?: string; changeRequestId?: string; purchaseRequestId?: string; paymentMethod?: string; reference?: string; note?: string; screenshotUrl?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { subscriptionId, changeRequestId, purchaseRequestId, paymentMethod, reference, note, screenshotUrl } = request.data || {}
  if ((!subscriptionId && !changeRequestId && !purchaseRequestId) || !paymentMethod || !reference) throw new HttpsError('invalid-argument', 'بيانات الدفع غير مكتملة')
  if (!/^[0-9]{6,24}$/.test(String(reference).trim())) throw new HttpsError('invalid-argument', 'رقم العملية غير صالح')
  const rawPayment = request.data as Record<string, unknown> | undefined
  if (rawPayment && ['planId', 'amount', 'status', 'expiresAt', 'approvedBy', 'limits', 'features'].some((field) => field in rawPayment)) {
    throw new HttpsError('invalid-argument', 'الخطة والمبلغ والحالة تُحدد من الخادم')
  }

  if (purchaseRequestId) {
    const purchaseRef = db.doc(`storePurchaseRequests/${purchaseRequestId}`)
    const purchaseSnap = await purchaseRef.get()
    if (!purchaseSnap.exists) throw new HttpsError('not-found', 'طلب شراء المتجر غير موجود')
    const purchase = purchaseSnap.data()!
    if (purchase.merchantId !== request.auth.uid) throw new HttpsError('permission-denied', 'لا تملك هذا الطلب')
    if (purchase.status !== 'pending_payment') throw new HttpsError('failed-precondition', 'طلب الشراء ليس بانتظار الدفع')
    const offer = purchase.offerSnapshot || {}
    const amount = Number(offer.oneTimePrice || purchase.quotedAmount || 0)
    if (!Number.isFinite(amount) || amount <= 0 || amount !== Number(purchase.quotedAmount || 0)) {
      throw new HttpsError('failed-precondition', 'تعذر التحقق من سعر الشراء')
    }
    const payRef = db.collection('subscriptionPayments').doc()
    await db.runTransaction(async (tx) => {
      const current = await tx.get(purchaseRef)
      if (!current.exists || current.data()?.status !== 'pending_payment') throw new HttpsError('already-exists', 'يوجد طلب دفع قيد المراجعة بالفعل')
      tx.create(payRef, {
        id: payRef.id,
        subscriptionId: purchase.subscriptionId,
        purchaseRequestId,
        storeId: purchase.storeId,
        merchantId: purchase.merchantId,
        offerId: purchase.offerId,
        planId: purchase.offerId,
        planName: offer.name || purchase.offerId,
        paymentPurpose: 'one_time_store_purchase',
        amount,
        currency: purchase.currency || 'EGP',
        paymentMethod: String(paymentMethod),
        reference: String(reference).trim(),
        note: note || '',
        screenshotUrl: screenshotUrl || null,
        status: 'pending',
        createdAt: now(),
        updatedAt: now(),
        createdBy: request.auth!.uid,
      })
      tx.update(purchaseRef, { status: 'pending_approval', paymentId: payRef.id, submittedAt: now(), updatedAt: now() })
    })
    await auditLog(purchase.storeId, request.auth.uid, 'payment_submitted', 'subscriptionPayments', payRef.id, { amount, purchaseRequestId, paymentPurpose: 'one_time_store_purchase' })
    return { id: payRef.id, amount, status: 'pending', purchaseRequestId }
  }

  // Plan changes have their own request object.  The target plan, amount and
  // limits are snapshotted by the server; no browser-supplied amount/plan can
  // enter the payment record.
  if (changeRequestId) {
    const changeRef = db.doc(`subscriptionChangeRequests/${changeRequestId}`)
    const changeSnap = await changeRef.get()
    if (!changeSnap.exists) throw new HttpsError('not-found', 'طلب تغيير الباقة غير موجود')
    const change = changeSnap.data()!
    const userSnap = await db.doc(`users/${request.auth.uid}`).get()
    const user = userSnap.data()
    if (!user || user.role !== 'merchant' || !(user.storeIds || []).includes(change.storeId)) {
      throw new HttpsError('permission-denied', 'لا تملك هذا الطلب')
    }
    if (change.status !== 'pending_payment') {
      throw new HttpsError('failed-precondition', 'طلب تغيير الباقة ليس بانتظار الدفع')
    }
    const target = change.planSnapshot || {}
    const amount = change.billingCycle === 'yearly'
      ? Number(target.priceYearly || target.priceMonthly || 0)
      : Number(target.priceMonthly || 0)
    if (!Number.isFinite(amount) || amount <= 0 || amount !== Number(change.quotedAmount || 0)) {
      throw new HttpsError('failed-precondition', 'تعذر التحقق من مبلغ الباقة')
    }
    const payRef = db.collection('subscriptionPayments').doc()
    await db.runTransaction(async (tx) => {
      const current = await tx.get(changeRef)
      if (!current.exists || current.data()?.status !== 'pending_payment') {
        throw new HttpsError('already-exists', 'يوجد طلب دفع قيد المراجعة بالفعل')
      }
      const currentSub = await tx.get(db.doc(`subscriptions/${change.subscriptionId}`))
      if (!currentSub.exists || currentSub.data()?.planId !== change.fromPlanId) {
        throw new HttpsError('failed-precondition', 'لم يعد طلب تغيير الباقة متوافقاً مع الاشتراك الحالي')
      }
      tx.create(payRef, {
        id: payRef.id,
        subscriptionId: change.subscriptionId,
        changeRequestId,
        storeId: change.storeId,
        planId: change.toPlanId,
        planName: change.toPlanName,
        amount,
        billingCycle: change.billingCycle,
        paymentPurpose: 'subscription_upgrade',
        paymentMethod: String(paymentMethod),
        reference: String(reference).trim(),
        note: note || '',
        screenshotUrl: screenshotUrl || null,
        status: 'pending',
        periodNumber: Number(change.periodNumber || 1),
        createdAt: now(),
        updatedAt: now(),
        createdBy: request.auth!.uid,
      })
      tx.update(changeRef, { status: 'pending_approval', paymentId: payRef.id, submittedAt: now(), updatedAt: now() })
    })
    await createBillingNotification(change.storeId, request.auth.uid, 'تم إرسال طلب تغيير الباقة', `تم استلام طلب تغيير الباقة بمبلغ ${amount} ج.م. وهو قيد المراجعة.`)
    await auditLog(change.storeId, request.auth.uid, 'payment_submitted', 'subscriptionPayments', payRef.id, { amount, changeRequestId })
    return { id: payRef.id, amount, status: 'pending', changeRequestId }
  }

  const subRef = db.doc(`subscriptions/${subscriptionId}`)
  const subSnap = await subRef.get()
  if (!subSnap.exists) throw new HttpsError('not-found', 'الاشتراك غير موجود')
  const sub = subSnap.data()!

  const userSnap = await db.doc(`users/${request.auth.uid}`).get()
  const user = userSnap.data()
  if (!user || user.role !== 'merchant' || !(user.storeIds || []).includes(sub.storeId)) {
    throw new HttpsError('permission-denied', 'لا تملك هذا الاشتراك')
  }

  const status = resolveSubscriptionStatus(sub)
  // Allow recovery from suspension (trial grace expired without payment) in
  // addition to the trialing/expired states. Suspended stores are NOT
  // purchasable (getPublicStoreStatus), but the owning merchant can still
  // submit a payment request to re-activate.
  if (status !== 'expired' && status !== 'trialing' && status !== 'suspended') {
    throw new HttpsError('failed-precondition', 'الاشتراك الحالي لا يحتاج إلى تفعيل')
  }

  const pendingSnap = await db.collection('subscriptionPayments')
    .where('subscriptionId', '==', subscriptionId)
    .where('status', '==', 'pending')
    .limit(1)
    .get()
  if (!pendingSnap.empty) throw new HttpsError('already-exists', 'يوجد طلب تفعيل قيد المراجعة بالفعل')

  const periodNumber = Number(sub.periodNumber || 0) + 1
  const normalPriceSnapshot = Number(sub.normalPriceSnapshot || 0)
  const launchPriceSnapshot = Number(sub.launchPriceSnapshot || normalPriceSnapshot)
  const yearlyPriceSnapshot = Number(sub.yearlyPriceSnapshot || 0)
  const isYearly = sub.billingCycle === 'yearly'
  // Fetch live canonical price for renewal/activation to honor Launch Pricing
  // (249/399/649). Historical snapshots stay as audit history, but new
  // transactions must use the current canonical price (lower = discount,
  // higher never raises an existing customer).
  let livePlan: any = null
  try {
    const liveSnap = await db.doc(`plans/${sub.planId}`).get()
    livePlan = liveSnap.exists ? liveSnap.data() : null
    const canonical = CANONICAL_PLANS.find((c) => c.id === sub.planId)
    if (canonical) livePlan = { ...livePlan, ...canonical }
  } catch { livePlan = null }
  const liveMonthly = Number(livePlan?.priceMonthly || 0)
  const liveYearly = Number(livePlan?.priceYearly || liveMonthly * 10 || 0)
  const snapAmount = isYearly
    ? yearlyPriceSnapshot || normalPriceSnapshot
    : periodNumber <= 1
      ? launchPriceSnapshot
      : normalPriceSnapshot
  const liveAmount = isYearly ? (liveYearly || liveMonthly) : liveMonthly
  let amount = snapAmount
  if (liveAmount > 0 && snapAmount > 0) amount = Math.min(snapAmount, liveAmount)
  else if (liveAmount > 0) amount = liveAmount
  // Never trust client price — amount is server-derived canonical launch price.
  if (amount <= 0) throw new HttpsError('failed-precondition', 'تعذر تحديد مبلغ الاشتراك')

  const payRef = db.collection('subscriptionPayments').doc()
  await db.runTransaction(async (tx) => {
    const current = await tx.get(subRef)
    if (!current.exists) throw new HttpsError('not-found', 'الاشتراك غير موجود')
    const pendingId = current.data()?.pendingPaymentId
    if (pendingId) {
      const pending = await tx.get(db.doc(`subscriptionPayments/${pendingId}`))
      if (pending.exists && pending.data()?.status === 'pending') {
        throw new HttpsError('already-exists', 'يوجد طلب تفعيل قيد المراجعة بالفعل')
      }
    }
    tx.create(payRef, {
      id: payRef.id,
      subscriptionId,
      storeId: sub.storeId,
      planId: sub.planId,
      planName: sub.planName || sub.planId,
      amount,
      paymentPurpose: periodNumber <= 1 ? 'subscription_activation' : 'subscription_renewal',
      paymentMethod: String(paymentMethod),
      reference: String(reference).trim(),
      note: note || '',
      screenshotUrl: screenshotUrl || null,
      status: 'pending',
      periodNumber,
      billingCycle: sub.billingCycle || 'monthly',
      createdAt: now(),
      updatedAt: now(),
      createdBy: request.auth!.uid,
    })
    tx.update(subRef, { pendingPaymentId: payRef.id, updatedAt: now() })
  })

  await createBillingNotification(sub.storeId, request.auth.uid, 'تم إرسال طلب التفعيل', `تم استلام طلب تفعيل اشتراكك بمبلغ ${amount} ج.م. وهو قيد المراجعة من إدارة المنصة.`)
  await auditLog(sub.storeId, request.auth.uid, 'payment_submitted', 'subscriptionPayments', payRef.id, { amount, periodNumber })

  return { id: payRef.id, amount, status: 'pending' }
})

// ─────────────────────────────────────────────────────────────
// 4f. approvePaymentRequest — platform admin approves a manual payment.
//     Only an authorized super admin can activate a subscription. The first
//     paid month uses the launch price; renewals use the normal price.
// ─────────────────────────────────────────────────────────────
export const approvePaymentRequest = onCall(async (request: CallableRequest<{ paymentRequestId?: string; note?: string }>) => {
  await assertPlatformAdmin(request)
  const { paymentRequestId, note } = request.data || {}
  if (!paymentRequestId) throw new HttpsError('invalid-argument', 'paymentRequestId مطلوب')

  const payRef = db.doc(`subscriptionPayments/${paymentRequestId}`)
  const result = await db.runTransaction(async (tx) => {
    // Every read happens before the first write.  The payment document is the
    // idempotency gate: only a pending request can transition to approved.
    const paySnap = await tx.get(payRef)
    if (!paySnap.exists) throw new HttpsError('not-found', 'طلب الدفع غير موجود')
    const pay = paySnap.data()!
    if (pay.status === 'approved') return { alreadyApproved: true, pay, store: null, plan: null, sub: null }
    if (pay.status !== 'pending') throw new HttpsError('failed-precondition', 'طلب الدفع تمت معالجته بالفعل')

    const subRef = db.doc(`subscriptions/${pay.subscriptionId}`)
    const storeRef = db.doc(`stores/${pay.storeId}`)
    const subSnap = await tx.get(subRef)
    const storeSnap = await tx.get(storeRef)
    if (!subSnap.exists || !storeSnap.exists) throw new HttpsError('not-found', 'الاشتراك أو المتجر غير موجود')
    const sub = subSnap.data()!
    const store = storeSnap.data()!
    const ownerRef = store.ownerId ? db.doc(`users/${store.ownerId}`) : null
    const ownerSnap = ownerRef ? await tx.get(ownerRef) : null

    const purchaseRef = pay.purchaseRequestId ? db.doc(`storePurchaseRequests/${pay.purchaseRequestId}`) : null
    const purchaseSnap = purchaseRef ? await tx.get(purchaseRef) : null
    if (purchaseRef) {
      if (!purchaseSnap?.exists || purchaseSnap.data()?.status !== 'pending_approval' || purchaseSnap.data()?.paymentId !== pay.id) {
        throw new HttpsError('failed-precondition', 'طلب شراء المتجر غير صالح للموافقة')
      }
      const purchase = purchaseSnap.data()!
      const offer = purchase.offerSnapshot || {}
      const offerRef = db.doc(`plans/${purchase.offerId}`)
      const liveOfferSnap = await tx.get(offerRef)
      if (!liveOfferSnap.exists || liveOfferSnap.data()?.billingModel !== 'one_time') {
        throw new HttpsError('failed-precondition', 'عرض الشراء المرتبط غير موجود أو غير صالح')
      }
      const expectedAmount = Number(offer.oneTimePrice || purchase.quotedAmount || 0)
      if (purchase.billingModel !== 'one_time' || purchase.offerId !== pay.offerId || pay.planId !== purchase.offerId || pay.paymentPurpose !== 'one_time_store_purchase' || Number(pay.amount) !== expectedAmount || Number(purchase.quotedAmount) !== expectedAmount) {
        throw new HttpsError('failed-precondition', 'بيانات شراء المتجر لا تطابق السعر المحسوب من الخادم')
      }
      if (sub.billingModel === 'one_time' && sub.lifetimeAccess === true) {
        throw new HttpsError('already-exists', 'المتجر مملوك بالفعل')
      }
      const nowMs = Date.now()
      const txRef = db.collection('transactions').doc()
      tx.update(payRef, { status: 'approved', reviewedBy: request.auth!.uid, reviewedAt: now(), reviewNote: note || pay.reviewNote || null, updatedAt: now() })
      tx.update(subRef, {
        status: 'active',
        planId: purchase.offerId,
        planName: offer.name || purchase.offerId,
        billingModel: 'one_time',
        ownershipType: 'lifetime',
        lifetimeAccess: true,
        purchasedAt: now(),
        purchasePaymentId: pay.id,
        purchaseOfferId: purchase.offerId,
        previousBillingModel: purchase.previousBillingModel || sub.billingModel || 'subscription',
        previousPlanId: purchase.previousPlanId || sub.planId || null,
        previousPlanName: purchase.previousPlanName || sub.planName || null,
        purchaseSnapshot: offer,
        limitsSnapshot: {
          orderLimitPerMonth: Number(offer.orderLimitPerMonth || 0),
          productLimit: Number(offer.productLimit || 0),
          landingPagesLimit: Number(offer.landingPagesLimit || 0),
          salesLinksLimit: Number(offer.salesLinksLimit || 0),
          staffLimit: Number(offer.staffLimit || 0),
          storageLimit: Number(offer.storageLimit || 0),
        },
        featuresSnapshot: Array.isArray(offer.features) ? offer.features : [],
        featureFlagsSnapshot: Object.fromEntries(PLAN_FEATURE_KEYS.map((key) => [key, offer[key] === true])),
        currentPeriodStart: FieldValue.delete(),
        currentPeriodEnd: FieldValue.delete(),
        expiresAt: FieldValue.delete(),
        trialStartedAt: FieldValue.delete(),
        trialEndsAt: FieldValue.delete(),
        pendingPaymentId: FieldValue.delete(),
        activeChangeRequestId: FieldValue.delete(),
        updatedAt: now(),
      })
      tx.update(storeRef, {
        activeSubscriptionId: pay.subscriptionId,
        storageLimitBytes: Number(offer.storageLimit || 0) * 1024 * 1024,
        updatedAt: now(),
      })
      if (ownerRef && ownerSnap?.exists) tx.update(ownerRef, { active: true, merchantStatus: 'active', updatedAt: now() })
      tx.update(purchaseRef, { status: 'approved', approvedAt: now(), processedAt: now(), updatedAt: now() })
      tx.create(txRef, {
        storeId: pay.storeId,
        type: 'subscription',
        amount: expectedAmount,
        status: 'completed',
        description: `شراء ملكية المتجر — ${offer.name || purchase.offerId}`,
        reference: pay.reference,
        subscriptionId: pay.subscriptionId,
        paymentId: pay.id,
        paymentPurpose: 'one_time_store_purchase',
        createdAt: now(),
        updatedAt: now(),
        createdBy: request.auth!.uid,
      })
      return { alreadyApproved: false, pay, store, plan: offer, sub, periodNumber: Number(sub.periodNumber || 0), expectedAmount, purchase: true, purchaseRequestId: pay.purchaseRequestId }
    }

    const changeRef = pay.changeRequestId ? db.doc(`subscriptionChangeRequests/${pay.changeRequestId}`) : null
    const changeSnap = changeRef ? await tx.get(changeRef) : null
    if (changeRef && (!changeSnap?.exists || changeSnap.data()?.status !== 'pending_approval' || changeSnap.data()?.paymentId !== pay.id)) {
      throw new HttpsError('failed-precondition', 'طلب تغيير الباقة غير صالح للموافقة')
    }

    const targetPlanId = changeSnap?.exists ? String(changeSnap.data()?.toPlanId || '') : String(sub.planId || '')
    const planRef = db.doc(`plans/${targetPlanId}`)
    const planSnap = await tx.get(planRef)
    if (!planSnap.exists) throw new HttpsError('failed-precondition', 'الباقة المرتبطة بالدفع غير موجودة')
    const livePlan = planSnap.data()!
    const plan = changeSnap?.exists
      ? { ...livePlan, ...(changeSnap.data()?.planSnapshot || {}) }
      : livePlan
    const cycle = String(pay.billingCycle || changeSnap?.data()?.billingCycle || sub.billingCycle || 'monthly') === 'yearly' ? 'yearly' : 'monthly'
    const periodNumber = Number(pay.periodNumber || Number(sub.periodNumber || 0) + 1)
    // Resolve canonical launch pricing (249/399/649) for renewals/activations.
    // Historical snapshots are kept as audit history, but new transactions use
    // the live canonical price (lower wins to never raise price).
    const canonicalLive = CANONICAL_PLANS.find((c: any) => c.id === targetPlanId) as any
    const liveMonthlyCan = Number(canonicalLive?.priceMonthly ?? plan.priceMonthly ?? 0)
    const liveYearlyCan = Number(canonicalLive?.priceYearly ?? plan.priceYearly ?? (liveMonthlyCan * 10)) || 0
    let expectedAmount: number
    if (changeSnap?.exists) {
      expectedAmount = cycle === 'yearly' ? (liveYearlyCan || liveMonthlyCan) : liveMonthlyCan
    } else {
      const snapMonthly = periodNumber <= 1 ? Number(sub.launchPriceSnapshot || sub.normalPriceSnapshot || 0) : Number(sub.normalPriceSnapshot || 0)
      const snapYearly = Number(sub.yearlyPriceSnapshot || 0)
      const snapAmount = cycle === 'yearly' ? (snapYearly || snapMonthly) : snapMonthly
      const liveAmount = cycle === 'yearly' ? (liveYearlyCan || liveMonthlyCan) : liveMonthlyCan
      if (liveAmount > 0 && snapAmount > 0) expectedAmount = Math.min(snapAmount, liveAmount)
      else expectedAmount = liveAmount || snapAmount
      if (!expectedAmount || !Number.isFinite(expectedAmount) || expectedAmount <= 0) expectedAmount = liveAmount || snapAmount || Number(plan.priceMonthly || 0)
    }
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0 || Number(pay.amount) !== expectedAmount) {
      throw new HttpsError('failed-precondition', 'مبلغ الدفع لا يطابق السعر المحسوب من الخادم')
    }
    if (String(pay.planId || '') !== targetPlanId) {
      throw new HttpsError('failed-precondition', 'الباقة المرتبطة بالدفع غير متسقة')
    }

    const nowMs = Date.now()
    const periodDays = cycle === 'yearly' ? YEAR_DAYS : PERIOD_DAYS
    const planName = changeSnap?.exists ? String(changeSnap.data()?.toPlanName || plan.name || targetPlanId) : String(sub.planName || plan.name || targetPlanId)
    const txRef = db.collection('transactions').doc()
    tx.update(payRef, { status: 'approved', reviewedBy: request.auth!.uid, reviewedAt: now(), reviewNote: note || pay.reviewNote || null, updatedAt: now() })
    tx.update(subRef, {
      status: 'active',
      planId: targetPlanId,
      planName,
      approvedBy: request.auth!.uid,
      adminEmail: null,
      activatedAt: tsFromDate(new Date(nowMs)),
      currentPeriodStart: tsFromDate(new Date(nowMs)),
      currentPeriodEnd: tsFromDate(new Date(nowMs + periodDays * DAY_MS)),
      // A plan change must not erase usage history. Renewal periods retain the
      // historical reset behavior, while upgrades/downgrades preserve usage.
      ordersUsed: changeSnap?.exists ? Number(sub.ordersUsed || 0) : 0,
      periodNumber,
      billingCycle: cycle,
      // New snapshots use canonical launch pricing (249/399/649, yearly ×10).
      // Never raise price — lower of live vs snapshot wins; historical billingSnapshots keep old audit trail.
      normalPriceSnapshot: (() => {
        if (changeSnap?.exists) return liveMonthlyCan
        const snap = Number(sub.normalPriceSnapshot || 0)
        if (snap > 0 && liveMonthlyCan > 0) return Math.min(snap, liveMonthlyCan)
        return liveMonthlyCan || snap || Number(plan.priceMonthly || 0)
      })(),
      launchPriceSnapshot: (() => {
        if (changeSnap?.exists) return liveMonthlyCan
        const snap = Number(sub.launchPriceSnapshot || sub.normalPriceSnapshot || 0)
        if (snap > 0 && liveMonthlyCan > 0) return Math.min(snap, liveMonthlyCan)
        return liveMonthlyCan || snap || Number(plan.priceMonthly || 0)
      })(),
      yearlyPriceSnapshot: (() => {
        if (changeSnap?.exists) return liveYearlyCan
        const snap = Number(sub.yearlyPriceSnapshot || 0)
        if (snap > 0 && liveYearlyCan > 0) return Math.min(snap, liveYearlyCan)
        return liveYearlyCan || snap || Number(plan.priceYearly || 0)
      })(),
      limitsSnapshot: {
        orderLimitPerMonth: Number(plan.orderLimitPerMonth || 0),
        productLimit: Number(plan.productLimit || 0),
        landingPagesLimit: Number(plan.landingPagesLimit || 0),
        salesLinksLimit: Number(plan.salesLinksLimit || 0),
        staffLimit: Number(plan.staffLimit || 0),
        storageLimit: Number(plan.storageLimit || 0),
        ...(typeof plan.unlimitedProducts === 'boolean' ? { unlimitedProducts: plan.unlimitedProducts } : {}),
        ...(typeof plan.unlimitedSalesLinks === 'boolean' ? { unlimitedSalesLinks: plan.unlimitedSalesLinks } : {}),
      },
      featuresSnapshot: Array.isArray(plan.features) ? plan.features : [],
      featureFlagsSnapshot: Object.fromEntries(PLAN_FEATURE_KEYS.map((key) => [key, plan[key] === true])),
      launchUsed: false,
      activeChangeRequestId: FieldValue.delete(),
      pendingPaymentId: FieldValue.delete(),
      trialStartedAt: FieldValue.delete(),
      trialEndsAt: FieldValue.delete(),
      lastPaymentRequestId: pay.id,
      updatedAt: now(),
    })
    tx.update(storeRef, {
      activeSubscriptionId: pay.subscriptionId,
      storageLimitBytes: Number(plan.storageLimit || 0) * 1024 * 1024,
      updatedAt: now(),
    })
    if (ownerRef && ownerSnap?.exists) tx.update(ownerRef, { active: true, merchantStatus: 'active', updatedAt: now() })
    if (changeRef) tx.update(changeRef, { status: 'approved', processedAt: now(), updatedAt: now() })
    tx.create(txRef, {
      storeId: pay.storeId,
      type: 'subscription',
      amount: expectedAmount,
      status: 'completed',
      description: `تفعيل الباقة ${planName} — الدورة ${periodNumber}`,
      reference: pay.reference,
      subscriptionId: pay.subscriptionId,
      paymentId: pay.id,
      createdAt: now(),
      updatedAt: now(),
      createdBy: request.auth!.uid,
    })
    return { alreadyApproved: false, pay, store, plan, sub, periodNumber, expectedAmount, changeRequestId: pay.changeRequestId || null }
  })

  if (result.alreadyApproved) return { ok: true, alreadyApproved: true }
  if (result.purchase) {
    await recordBillingSnapshot(result.pay.storeId, {
      type: 'manual',
      planId: result.pay.offerId || result.pay.planId,
      planName: result.plan?.name || result.pay.planName || result.pay.planId,
      priceMonthly: 0,
      priceYearly: 0,
      orderLimitPerMonth: Number(result.plan?.orderLimitPerMonth || 0),
      productLimit: Number(result.plan?.productLimit || 0),
      storageLimitMB: Number(result.plan?.storageLimit || 0),
      currency: result.store?.currency || 'EGP',
      by: request.auth!.uid,
      note: 'اعتماد شراء ملكية المتجر لمرة واحدة',
    })
    await createBillingNotification(result.pay.storeId, result.store?.ownerId || null, 'تم اعتماد ملكية متجرك', 'تم اعتماد الدفع وأصبح متجرك مملوكاً مدى الحياة وفق حدود ومزايا عرض الشراء.')
    await auditLog(result.pay.storeId, request.auth!.uid, 'one_time_purchase_approved', 'storePurchaseRequests', result.purchaseRequestId || result.pay.id, { paymentId: result.pay.id, offerId: result.pay.offerId, amount: result.expectedAmount, previousBillingModel: result.sub?.billingModel || 'subscription', newBillingModel: 'one_time' })
    return { ok: true, alreadyApproved: false, purchase: true }
  }
  await recordBillingSnapshot(result.pay.storeId, {
    type: result.changeRequestId ? 'plan_change' : 'activation',
    planId: result.pay.planId,
    planName: result.plan?.name || result.pay.planName || result.pay.planId,
    priceMonthly: Number(result.plan?.priceMonthly || 0),
    priceYearly: Number(result.plan?.priceYearly || 0),
    orderLimitPerMonth: Number(result.plan?.orderLimitPerMonth || 0),
    productLimit: Number(result.plan?.productLimit || 0),
    storageLimitMB: Number(result.plan?.storageLimit || 0),
    currency: result.store?.currency || 'EGP',
    by: request.auth!.uid,
    note: result.changeRequestId ? 'اعتماد تغيير الباقة بعد موافقة الدفع' : 'تفعيل الاشتراك بعد موافقة الدفع',
  })
  await createBillingNotification(result.pay.storeId, result.store?.ownerId || null, 'تم تفعيل اشتراكك', `اشتراك ${result.plan?.name || result.pay.planName || ''} أصبح نشطاً. شكراً لثقتك — استمتع بالباقة!`)
  await auditLog(result.pay.storeId, request.auth!.uid, result.changeRequestId ? 'subscription_change_approved' : 'payment_approved', 'subscriptionPayments', result.pay.id, { amount: result.expectedAmount, periodNumber: result.periodNumber, changeRequestId: result.changeRequestId })
  return { ok: true, alreadyApproved: false }
})

// ─────────────────────────────────────────────────────────────
// 4g. rejectPaymentRequest — platform admin rejects a manual payment.
//     The subscription stays EXPIRED; the merchant may submit again.
// ─────────────────────────────────────────────────────────────
export const rejectPaymentRequest = onCall(async (request: CallableRequest<{ paymentRequestId?: string; reason?: string }>) => {
  await assertPlatformAdmin(request)
  const { paymentRequestId, reason } = request.data || {}
  if (!paymentRequestId) throw new HttpsError('invalid-argument', 'paymentRequestId مطلوب')

  const payRef = db.doc(`subscriptionPayments/${paymentRequestId}`)
  const paySnap = await payRef.get()
  if (!paySnap.exists) throw new HttpsError('not-found', 'طلب الدفع غير موجود')
  const pay = paySnap.data()!
  if (pay.status === 'rejected') return { ok: true }
  if (pay.status === 'approved') throw new HttpsError('failed-precondition', 'لا يمكن رفض دفعة تمت الموافقة عليها')

  const changeRef = pay.changeRequestId ? db.doc(`subscriptionChangeRequests/${pay.changeRequestId}`) : null
  const purchaseRef = pay.purchaseRequestId ? db.doc(`storePurchaseRequests/${pay.purchaseRequestId}`) : null
  await db.runTransaction(async (tx) => {
    const current = await tx.get(payRef)
    if (!current.exists) throw new HttpsError('not-found', 'طلب الدفع غير موجود')
    if (current.data()?.status === 'approved') throw new HttpsError('failed-precondition', 'لا يمكن رفض دفعة تمت الموافقة عليها')
    const purchaseCurrent = purchaseRef ? await tx.get(purchaseRef) : null
    const purchaseData = purchaseCurrent?.exists ? purchaseCurrent.data() : null
    const offerRef = purchaseData?.offerId ? db.doc(`plans/${purchaseData.offerId}`) : null
    const offerCurrent = offerRef ? await tx.get(offerRef) : null
    tx.update(payRef, { status: 'rejected', reviewedBy: request.auth!.uid, reviewedAt: now(), reviewNote: reason || current.data()?.reviewNote || null, updatedAt: now() })
    if (changeRef) tx.update(changeRef, { status: 'rejected', processedAt: now(), updatedAt: now() })
    if (purchaseRef) tx.update(purchaseRef, { status: 'rejected', processedAt: now(), updatedAt: now() })
    if (offerRef && offerCurrent?.exists && purchaseData?.launchOfferSlotReserved === true) {
      const sold = Number(offerCurrent.data()?.launchOfferSoldCount || 0)
      tx.update(offerRef, { launchOfferSoldCount: Math.max(0, sold - 1), updatedAt: now() })
    }
    if (!changeRef && pay.subscriptionId) tx.update(db.doc(`subscriptions/${pay.subscriptionId}`), { pendingPaymentId: FieldValue.delete(), updatedAt: now() })
  })

  await createBillingNotification(pay.storeId, null, 'تعذر تأكيد عملية الدفع', reason ? `لم يتم تأكيد عملية الدفع: ${reason}. يمكنك إرسال طلب آخر.` : 'تعذر تأكيد عملية الدفع. يمكنك إرسال طلب آخر بعد التحقق من البيانات.')
  await auditLog(pay.storeId, request.auth!.uid, 'payment_rejected', 'subscriptionPayments', pay.id, { reason: reason || '' })

  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// 4h. getPublicStoreStatus — safe public status for the storefront.
//     Returns ONLY { purchasable, reason }. Never leaks plan/price/limits or
//     any internal field. Used to show a professional "اشتراك مطلوب" page.
// ─────────────────────────────────────────────────────────────
export const getPublicStoreStatus = onCall(async (request: CallableRequest<{ slug?: string }>) => {
  const { slug } = request.data || {}
  if (!slug) throw new HttpsError('invalid-argument', 'slug مطلوب')

  const storeSnap = await db.collection('stores').where('slug', '==', String(slug)).limit(1).get()
  if (storeSnap.empty) return { purchasable: false, reason: 'not_found' }
  const storeId = storeSnap.docs[0].id
  const store = storeSnap.docs[0].data()!
  if (!store.active) return { purchasable: false, reason: 'inactive' }
  if (storePublicationStatus(store) !== 'published') return { purchasable: false, reason: 'unpublished' }

  const entry = await latestSubscriptionForStore(storeId)
  if (!entry) return { purchasable: false, reason: 'no_subscription' }
  const status = resolveSubscriptionStatus(entry.data)
  if (status === 'expired' && entry.data.status !== 'expired') {
    await expireSubscriptionLazily(storeId, entry.id, entry.data).catch(() => {})
  }
  const purchasable = status === 'trialing' || status === 'active'
  return { purchasable, reason: purchasable ? 'ok' : 'subscription_required' }
})

export const getPublicStore = onCall(async (request: CallableRequest<{ slug?: string; preview?: boolean }>) => {
  const { slug } = request.data || {}
  if (!slug) throw new HttpsError('invalid-argument', 'slug مطلوب')
  const internal = await db.collection('stores').where('slug', '==', String(slug)).limit(1).get()
  if (internal.empty) throw new HttpsError('not-found', 'المتجر غير موجود')
  const internalDoc = internal.docs[0]
  const internalData = internalDoc.data()!
  // Treat the canonical lifecycle value as authoritative. A historical
  // `published: true` flag must never keep a suspended store public.
  const isPublished = storePublicationStatus(internalData) === 'published'
    && internalData.active !== false
  const previewRequested = request.data?.preview === true
  let previewAuthorized = false

  // The safe store shell is allowed to resolve for an unpublished URL so the
  // client can render the canonical unavailable state. Product/order surfaces
  // remain gated by getPublicStoreStatus and never render for public visitors.
  // Draft preview requests additionally require an authenticated owner/admin.
  if (!isPublished && previewRequested) {
    if (!request.auth) throw new HttpsError('not-found', 'المتجر غير متاح')
    const viewer = (await db.doc(`users/${request.auth.uid}`).get()).data() || {}
    const canPreview = viewer.role === 'superAdmin'
      || ((viewer.role === 'merchant' || viewer.role === 'staff') && Array.isArray(viewer.storeIds) && viewer.storeIds.includes(internalDoc.id))
    if (!canPreview) throw new HttpsError('not-found', 'المتجر غير متاح')
    previewAuthorized = true
  }

  // Always build the storefront shell from the fresh, safe projection of the
  // canonical store document. This removes the small trigger-delay window in
  // which a newly uploaded logo or hero image existed internally but the
  // publicStores mirror still returned the older visual identity.
  const data = publicStoreData(internalData)!
  return { id: internalDoc.id, ...data, previewAuthorized }
})

// Public landing pages are served through a sanitized projection rather than
// direct Firestore reads. The source landingPages document contains tenant
// ownership, author and internal performance counters that must never reach a
// public browser.
function publicLandingData(id: string, data: any) {
  const hero = data.hero || {}
  const sections = Array.isArray(data.sections) ? data.sections.map((section: any) => ({
    type: section?.type,
    title: section?.title || undefined,
    body: section?.body || undefined,
    image: section?.image || undefined,
    items: Array.isArray(section?.items) ? section.items.map((item: any) => ({
      title: item?.title || undefined,
      body: item?.body || undefined,
    })) : [],
  })) : []
  return {
    id,
    slug: String(data.slug || ''),
    title: String(data.title || ''),
    template: String(data.template || 'default'),
    productId: data.productId || null,
    hero: {
      title: String(hero.title || data.title || ''),
      subtitle: hero.subtitle || undefined,
      ctaText: hero.ctaText || undefined,
      image: hero.image || undefined,
    },
    sections,
    seo: data.seo ? { title: data.seo.title || undefined, description: data.seo.description || undefined } : null,
  }
}

function publicLandingProductData(id: string, data: any) {
  if (!data || data.active !== true) return null
  return {
    id,
    name: data.name || '',
    description: data.description || '',
    price: Number(data.price || 0),
    oldPrice: data.oldPrice == null ? null : Number(data.oldPrice),
    images: Array.isArray(data.images) ? data.images : [],
    stock: Number(data.stock || 0),
    active: true,
    variants: Array.isArray(data.variants) ? data.variants.map((variant: any) => ({
      id: variant?.id,
      color: variant?.color,
      size: variant?.size,
      price: variant?.price == null ? undefined : Number(variant.price),
      stock: Number(variant?.stock || 0),
    })) : [],
    colors: Array.isArray(data.colors) ? data.colors : [],
    sizes: Array.isArray(data.sizes) ? data.sizes : [],
    colorOptions: Array.isArray(data.colorOptions) ? data.colorOptions : [],
    pricingMode: data.pricingMode || 'unit',
    quantityTiers: Array.isArray(data.quantityTiers) ? data.quantityTiers : [],
    quantityPricingStrategy: data.quantityPricingStrategy || 'cap',
  }
}

export const getPublicLandingPage = onCall(async (request: CallableRequest<{ slug?: string }>) => {
  const slug = String(request.data?.slug || '').trim()
  if (!slug || slug.length > 160) throw new HttpsError('invalid-argument', 'slug غير صالح')

  const landingSnap = await db.collection('landingPages').where('slug', '==', slug).limit(1).get()
  if (landingSnap.empty) throw new HttpsError('not-found', 'الصفحة غير موجودة')
  const landingDoc = landingSnap.docs[0]
  const landing = landingDoc.data()
  if (landing.active !== true || landing.status !== 'published') {
    throw new HttpsError('not-found', 'الصفحة غير موجودة')
  }

  const storeId = String(landing.storeId || '')
  if (!storeId) throw new HttpsError('not-found', 'الصفحة غير موجودة')
  const storeSnap = await db.doc(`publicStores/${storeId}`).get()
  if (!storeSnap.exists || storeSnap.data()?.active !== true || storeSnap.data()?.published !== true) {
    throw new HttpsError('not-found', 'الصفحة غير موجودة')
  }

  const store = { id: storeId, ...publicStoreData(storeSnap.data()) }
  let product = null
  if (landing.productId) {
    const productSnap = await db.doc(`publicStores/${storeId}/products/${landing.productId}`).get()
    if (productSnap.exists) {
      product = publicLandingProductData(productSnap.id, productSnap.data())
    } else {
      // Projection lag should not break a published page, but the fallback is
      // still sanitized before returning anything to the public client.
      const internalProduct = await db.doc(`products/${landing.productId}`).get()
      if (internalProduct.exists && internalProduct.data()?.storeId === storeId) {
        product = publicLandingProductData(internalProduct.id, internalProduct.data())
      }
    }
  }

  return { landing: publicLandingData(landingDoc.id, landing), store, product }
})

// Support tickets are created server-side so tenant ownership and actor
// identity always come from the authenticated profile, never from the client
// payload. Customers do not currently have a ticket creation surface; store
// merchants/staff (and platform admins acting for a store) use this endpoint.
export const createTicket = onCall(async (request: CallableRequest<{
  storeId?: string
  subject?: string
  description?: string
  priority?: string
}>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = String(request.data?.storeId || '').trim()
  const subject = String(request.data?.subject || '').trim()
  const description = String(request.data?.description || '').trim()
  const priority = String(request.data?.priority || 'medium')
  const raw = request.data as Record<string, unknown> | undefined
  if (raw && ['createdBy', 'role', 'tenantId', 'merchantId', 'actorId'].some((field) => field in raw)) {
    throw new HttpsError('invalid-argument', 'حقول الهوية والملكية تُحدد من الحساب الموثق')
  }
  if (!storeId || !subject || !description) throw new HttpsError('invalid-argument', 'بيانات التذكرة غير مكتملة')
  if (subject.length > 200 || description.length > 5000) throw new HttpsError('invalid-argument', 'بيانات التذكرة طويلة جداً')
  if (!['low', 'medium', 'high', 'urgent'].includes(priority)) throw new HttpsError('invalid-argument', 'أولوية غير صالحة')

  await assertStoreAccess(request, storeId, 'settings:view')
  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || storeSnap.data()?.active === false) throw new HttpsError('not-found', 'المتجر غير موجود')

  const role = await getUserRole(request.auth.uid)
  const ref = await db.collection('tickets').add({
    storeId,
    createdBy: request.auth.uid,
    createdByRole: role || 'merchant',
    subject,
    description,
    status: 'open',
    priority,
    assignedTo: null,
    lastReplyAt: null,
    closedAt: null,
    replies: [],
    createdAt: now(),
    updatedAt: now(),
  })
  await auditLog(storeId, request.auth.uid, 'create_ticket', 'tickets', ref.id, { subject })
  // notify platform
  const admins = await db.collection('users').where('role', '==', 'superAdmin').limit(5).get().catch(() => null)
  if (admins) {
    for (const admin of admins.docs) {
      await db.collection('notifications').add({
        userId: admin.id,
        storeId,
        title: 'تذكرة جديدة',
        body: `تذكرة جديدة من ${storeId}: ${subject}`,
        type: 'ticket',
        read: false,
        createdAt: now(),
        createdBy: request.auth.uid,
      }).catch(() => {})
    }
  }
  return { id: ref.id }
})

const TICKET_STATUSES = ['open', 'in_progress', 'waiting_merchant', 'waiting_support', 'resolved', 'closed'] as const
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

async function assertTicketAccess(request: CallableRequest, ticketId: string, requireStoreId?: string): Promise<any> {
  const snap = await db.doc(`tickets/${ticketId}`).get()
  if (!snap.exists) throw new HttpsError('not-found', 'التذكرة غير موجودة')
  const data = snap.data() as any
  const storeId = String(data.storeId || requireStoreId || '').trim()
  if (!storeId) throw new HttpsError('failed-precondition', 'التذكرة بدون متجر')
  const role = await getUserRole(request.auth!.uid)
  if (role === 'superAdmin') return data
  await assertStoreAccess(request, storeId, 'settings:view')
  return data
}

export const getTicket = onCall(async (request: CallableRequest<{ ticketId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const ticketId = String(request.data?.ticketId || '').trim()
  if (!ticketId) throw new HttpsError('invalid-argument', 'ticketId مطلوب')
  const data = await assertTicketAccess(request, ticketId)
  return { ticket: { id: ticketId, ...data } }
})

export const listTickets = onCall(async (request: CallableRequest<{ storeId?: string; status?: string; priority?: string; query?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const role = await getUserRole(request.auth!.uid)
  const storeId = String(request.data?.storeId || '').trim()
  const status = String(request.data?.status || '').trim()
  const priority = String(request.data?.priority || '').trim()
  const q = String(request.data?.query || '').trim().toLowerCase()
  if (role !== 'superAdmin') {
    if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')
    await assertStoreAccess(request, storeId, 'settings:view')
    let query: FirebaseFirestore.Query = db.collection('tickets').where('storeId', '==', storeId)
    if (status && TICKET_STATUSES.includes(status as any)) query = query.where('status', '==', status)
    if (priority && TICKET_PRIORITIES.includes(priority as any)) query = query.where('priority', '==', priority)
    query = query.orderBy('updatedAt', 'desc').limit(100)
    const snap = await query.get()
    let tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
    if (q) tickets = tickets.filter((t) => `${t.subject} ${t.description}`.toLowerCase().includes(q))
    return { tickets }
  }
  // platform
  let query: FirebaseFirestore.Query = db.collection('tickets')
  if (storeId) query = query.where('storeId', '==', storeId)
  if (status && TICKET_STATUSES.includes(status as any)) query = query.where('status', '==', status)
  if (priority && TICKET_PRIORITIES.includes(priority as any)) query = query.where('priority', '==', priority)
  query = query.orderBy('updatedAt', 'desc').limit(100)
  const snap = await query.get()
  let tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
  if (q) tickets = tickets.filter((t) => `${t.subject} ${t.description} ${t.storeId}`.toLowerCase().includes(q))
  return { tickets }
})

export const replyTicket = onCall(async (request: CallableRequest<{ ticketId?: string; body?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const ticketId = String(request.data?.ticketId || '').trim()
  const body = String(request.data?.body || '').trim()
  if (!ticketId || !body) throw new HttpsError('invalid-argument', 'ticketId والرسالة مطلوبان')
  if (body.length > 5000) throw new HttpsError('invalid-argument', 'الرسالة طويلة جداً')
  const ticket = await assertTicketAccess(request, ticketId)
  const storeId = String(ticket.storeId)
  const role = await getUserRole(request.auth!.uid)
  const isPlatform = role === 'superAdmin'
  const nextStatus = isPlatform ? 'waiting_merchant' : 'waiting_support'
  const reply = { by: request.auth.uid, body, at: Timestamp.now(), role: isPlatform ? 'superAdmin' : 'merchant' }
  await db.doc(`tickets/${ticketId}`).update({
    replies: FieldValue.arrayUnion(reply),
    lastReplyAt: now(),
    status: ticket.status === 'closed' ? 'open' : nextStatus,
    updatedAt: now(),
  })
  await auditLog(storeId, request.auth.uid, 'ticket_replied', 'tickets', ticketId, { by: role })
  const targetUserId = isPlatform ? ticket.createdBy : null
  // notify opposite side
  if (isPlatform && ticket.createdBy) {
    await db.collection('notifications').add({
      userId: ticket.createdBy,
      storeId,
      title: 'رد جديد على تذكرتك',
      body: `تم الرد على التذكرة: ${ticket.subject}`,
      type: 'ticket',
      read: false,
      createdAt: now(),
      createdBy: request.auth.uid,
    }).catch(() => {})
  } else if (!isPlatform) {
    // notify platform (broadcast to superAdmins via storeId? simplified: create notification for platform)
    const admins = await db.collection('users').where('role', '==', 'superAdmin').limit(5).get().catch(() => null)
    if (admins) {
      for (const admin of admins.docs) {
        await db.collection('notifications').add({
          userId: admin.id,
          storeId,
          title: 'رد جديد من التاجر',
          body: `رد على التذكرة: ${ticket.subject}`,
          type: 'ticket',
          read: false,
          createdAt: now(),
          createdBy: request.auth.uid,
        }).catch(() => {})
      }
    }
  }
  return { ok: true }
})

export const updateTicketStatus = onCall(async (request: CallableRequest<{ ticketId?: string; status?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const ticketId = String(request.data?.ticketId || '').trim()
  const status = String(request.data?.status || '').trim() as any
  if (!ticketId || !status) throw new HttpsError('invalid-argument', 'ticketId والحالة مطلوبان')
  if (!TICKET_STATUSES.includes(status)) throw new HttpsError('invalid-argument', 'حالة غير صالحة')
  const ticket = await assertTicketAccess(request, ticketId)
  const storeId = String(ticket.storeId)
  const role = await getUserRole(request.auth!.uid)
  if (role !== 'superAdmin') {
    // merchant can only close/reopen own ticket
    if (!['open', 'closed'].includes(status) && status !== 'open' && status !== 'closed') {
      // allow merchant to close/reopen only
      if (status !== 'closed' && status !== 'open') throw new HttpsError('permission-denied', 'لا تملك صلاحية تغيير الحالة')
    }
  }
  const update: any = { status, updatedAt: now() }
  if (status === 'closed') update.closedAt = now()
  if (status === 'open' && ticket.status === 'closed') update.closedAt = FieldValue.delete()
  await db.doc(`tickets/${ticketId}`).update(update)
  await auditLog(storeId, request.auth.uid, 'ticket_status_changed', 'tickets', ticketId, { from: ticket.status, to: status })
  return { ok: true }
})

export const assignTicket = onCall(async (request: CallableRequest<{ ticketId?: string; assignedTo?: string }>) => {
  await assertPlatformAdmin(request)
  const ticketId = String(request.data?.ticketId || '').trim()
  const assignedTo = String(request.data?.assignedTo || '').trim() || null
  if (!ticketId) throw new HttpsError('invalid-argument', 'ticketId مطلوب')
  const snap = await db.doc(`tickets/${ticketId}`).get()
  if (!snap.exists) throw new HttpsError('not-found', 'التذكرة غير موجودة')
  await db.doc(`tickets/${ticketId}`).update({ assignedTo, updatedAt: now() })
  await auditLog(snap.data()?.storeId || null, request.auth!.uid, 'ticket_assigned', 'tickets', ticketId, { assignedTo })
  return { ok: true }
})

export const closeTicket = onCall(async (request: CallableRequest<{ ticketId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const ticketId = String(request.data?.ticketId || '').trim()
  if (!ticketId) throw new HttpsError('invalid-argument', 'ticketId مطلوب')
  const ticket = await assertTicketAccess(request, ticketId)
  await db.doc(`tickets/${ticketId}`).update({ status: 'closed', closedAt: now(), updatedAt: now() })
  await auditLog(String(ticket.storeId), request.auth.uid, 'ticket_closed', 'tickets', ticketId, {})
  // notify
  const role = await getUserRole(request.auth!.uid)
  if (role === 'superAdmin' && ticket.createdBy) {
    await db.collection('notifications').add({ userId: ticket.createdBy, storeId: ticket.storeId, title: 'تم إغلاق التذكرة', body: ticket.subject, type: 'ticket', read: false, createdAt: now(), createdBy: request.auth.uid }).catch(() => {})
  }
  return { ok: true }
})

export const reopenTicket = onCall(async (request: CallableRequest<{ ticketId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const ticketId = String(request.data?.ticketId || '').trim()
  if (!ticketId) throw new HttpsError('invalid-argument', 'ticketId مطلوب')
  const ticket = await assertTicketAccess(request, ticketId)
  if (ticket.status !== 'closed' && ticket.status !== 'resolved') throw new HttpsError('failed-precondition', 'التذكرة ليست مغلقة')
  await db.doc(`tickets/${ticketId}`).update({ status: 'open', closedAt: FieldValue.delete(), updatedAt: now() })
  await auditLog(String(ticket.storeId), request.auth.uid, 'ticket_reopened', 'tickets', ticketId, {})
  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// 4i. setStorePublished — publish/unpublish a store through a callable so the
//     EXPIRED restriction can be enforced server-side (rules cannot query the
//     latest subscription). Publishing requires an active or trialing sub.
// ─────────────────────────────────────────────────────────────
export const setStorePublished = onCall(async (request: CallableRequest<{ storeId?: string; published?: boolean }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, published } = request.data || {}
  if (!storeId || typeof published !== 'boolean') throw new HttpsError('invalid-argument', 'بيانات غير صالحة')
  await assertStoreAccess(request, storeId, 'settings:edit')

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists) throw new HttpsError('not-found', 'المتجر غير موجود')

  if (published) {
    const grant = await grantForStore(storeId, request.auth.uid)
    if (!grant) throw new HttpsError('failed-precondition', 'لا يمكن نشر المتجر — الاشتراك غير نشط. فعّل باقتك أولاً.')
  }

  const currentStatus = storePublicationStatus(storeSnap.data())
  if (currentStatus === 'suspended') throw new HttpsError('failed-precondition', 'المتجر موقوف ولا يمكن تغيير حالة النشر')
  await db.runTransaction(async (tx) => {
    tx.update(db.doc(`stores/${storeId}`), { published, storeStatus: published ? 'published' : 'draft', updatedAt: now() })
    if (published && currentStatus !== 'published') {
      emitIntegrationEvent(db, tx, {
        eventId: `store-published-${storeId}-${Date.now()}`,
        storeId,
        eventType: 'store.published',
        entityType: 'store',
        entityId: storeId,
        payload: { storeId, previousStatus: currentStatus },
      })
    }
  })
  await auditLog(storeId, request.auth.uid, published ? 'store_published' : 'store_unpublished', 'stores', storeId)

  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// 4j. createLandingPage / createSalesLink — create-through-callable so the
//     EXPIRED restriction and plan limits (landingPagesLimit / salesLinksLimit)
//     are enforced server-side. Updates/deletes remain direct writes.
// ─────────────────────────────────────────────────────────────
export const createLandingPage = onCall(async (request: CallableRequest<any>) => {
  await assertStoreAccess(request, request.data?.storeId, 'landing:manage')
  const { storeId, data } = request.data || {}
  if (!storeId || !data || !data.slug || !data.title) throw new HttpsError('invalid-argument', 'بيانات صفحة الهبوط غير مكتملة')

  const grant = await grantForStore(storeId, request.auth?.uid)
  if (!grant) throw new HttpsError('failed-precondition', 'الاشتراك غير نشط — لا يمكن إنشاء صفحات هبوط الآن')

  const limit = Number(grant.plan?.landingPagesLimit || 0)
  const ref = db.collection('landingPages').doc()
  await db.runTransaction(async (tx) => {
    const count = await tx.get(db.collection('landingPages').where('storeId', '==', storeId))
    // A zero landing-page quota is an explicit denial for the canonical
    // catalog (Free has no landing pages). Do not treat it as unlimited.
    if (limit <= 0 || count.size >= limit) throw new HttpsError('resource-exhausted', `تم تجاوز حد صفحات الهبوط (${limit})`)

    // Landing pages share the global `/landing/:slug` route, so the slug must
    // be unique across ALL stores — including concurrent creates.
    const slugQuery = await tx.get(db.collection('landingPages').where('slug', '==', data.slug).limit(1))
    if (!slugQuery.empty) throw new HttpsError('already-exists', 'رابط الصفحة (slug) مستخدم مسبقاً — اختر رابطاً آخر')
    tx.create(ref, {
      storeId,
      slug: data.slug,
      title: data.title,
      status: data.status || 'draft',
      active: data.active ?? true,
      template: data.template || 'default',
      hero: data.hero || { title: data.title },
      sections: data.sections || [],
      seo: data.seo || null,
      productId: data.productId || null,
      views: 0,
      ordersCount: 0,
      totalRevenue: 0,
      createdAt: now(),
      updatedAt: now(),
      createdBy: request.auth?.uid || 'guest',
    })
  })

  await auditLog(storeId, request.auth?.uid || 'guest', 'create_landing_page', 'landingPages', ref.id, { title: data.title })
  return { id: ref.id }
})

export const createSalesLink = onCall(async (request: CallableRequest<any>) => {
  await assertStoreAccess(request, request.data?.storeId, 'sales_links:create')
  const { storeId, data } = request.data || {}
  if (!storeId || !data || !data.code) throw new HttpsError('invalid-argument', 'بيانات رابط البيع غير مكتملة')

  // `/s/:code` is a public global route, so its code must be globally unique.
  // Normalize it once on the server to prevent different casing from creating
  // two links that look identical to a customer.
  const code = String(data.code).trim().toLowerCase()
  if (!/^[a-z0-9_-]{3,80}$/.test(code)) {
    throw new HttpsError('invalid-argument', 'كود الرابط يجب أن يحتوي 3 إلى 80 حرفاً أو رقماً فقط')
  }

   const grant = await grantForStore(storeId, request.auth?.uid)
   if (!grant) throw new HttpsError('failed-precondition', 'الاشتراك غير نشط — لا يمكن إنشاء روابط بيع الآن')

   const salesLinksLimit = resolvedLimit(grant.plan, 'salesLinksLimit', 'unlimitedSalesLinks')
  const ref = db.collection('storeLinks').doc()
  await db.runTransaction(async (tx) => {
    const count = await tx.get(db.collection('storeLinks').where('storeId', '==', storeId).where('archived', '==', false))
    if (salesLinksLimit !== null && count.size >= salesLinksLimit) throw new HttpsError('resource-exhausted', `تم تجاوز حد روابط البيع (${salesLinksLimit})`)
    const linkQuery = await tx.get(db.collection('storeLinks').where('code', '==', code).limit(1))
    if (!linkQuery.empty) throw new HttpsError('already-exists', 'كود الرابط مستخدم مسبقاً')
    tx.create(ref, {
      storeId,
      code,
      name: data.name || code,
      title: data.title || data.name || code,
      sellerName: data.sellerName || null,
      destinationType: data.destinationType || 'home',
      destinationId: data.destinationId || null,
      source: data.source || null,
      campaign: data.campaign || null,
      content: data.content || null,
      staffId: data.staffId || null,
      active: data.active ?? true,
      archived: false,
      visits: 0,
      ordersCount: 0,
      totalRevenue: 0,
      createdAt: now(),
      updatedAt: now(),
      createdBy: request.auth?.uid || 'guest',
    })
  })

  await auditLog(storeId, request.auth?.uid || 'guest', 'create_sales_link', 'storeLinks', ref.id, { code })
  return { id: ref.id, code }
})

// ─────────────────────────────────────────────────────────────
// 4k. savePlan — platform admin creates/updates/deactivates a plan. Writes go
//     through a callable so plan changes are audited and plans attached to
//     active subscriptions are never hard-deleted (deactivate instead).
// ─────────────────────────────────────────────────────────────
export const savePlan = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request)
  const { planId, plan } = request.data || {}
  if (!plan || !plan.name) throw new HttpsError('invalid-argument', 'بيانات العرض غير مكتملة')
  const billingModel = plan.billingModel === 'one_time' ? 'one_time' : 'subscription'
  if (billingModel === 'subscription' && !(Number(plan.priceMonthly) >= 0)) throw new HttpsError('invalid-argument', 'السعر الشهري غير صالح')
  if (billingModel === 'one_time' && !(Number(plan.oneTimePrice) > 0)) throw new HttpsError('invalid-argument', 'سعر الشراء لمرة واحدة غير صالح')
  const paidPlan = billingModel === 'subscription' && (Number(plan.priceMonthly) > 0 || Number(plan.priceYearly) > 0)
  const configuredTrialDays = Number(plan.trialDays ?? 0)
  if (paidPlan && (!Number.isFinite(configuredTrialDays) || configuredTrialDays < 0 || configuredTrialDays > 90)) {
    throw new HttpsError('invalid-argument', 'مدة التجربة للباقة المدفوعة يجب أن تكون من صفر إلى 90 يوماً')
  }

  const payload: Record<string, any> = {
    name: String(plan.name),
    billingModel,
    oneTimePrice: billingModel === 'one_time' ? Number(plan.oneTimePrice) : 0,
    description: plan.description || '',
    priceMonthly: billingModel === 'one_time' ? 0 : Number(plan.priceMonthly),
    priceYearly: billingModel === 'one_time' ? 0 : Number(plan.priceYearly || 0),
    trialDays: paidPlan ? Math.floor(configuredTrialDays) : 0,
     launchPrice: Number(plan.launchPrice || 0),
     launchEnabled: !!plan.launchEnabled,
     productLimit: Number(plan.productLimit || 0),
    orderLimitPerMonth: Number(plan.orderLimitPerMonth || 0),
    landingPagesLimit: Number(plan.landingPagesLimit || 0),
    salesLinksLimit: Number(plan.salesLinksLimit || 0),
    staffLimit: Number(plan.staffLimit || 0),
    storageLimit: Number(plan.storageLimit || 0),
    isPopular: !!plan.isPopular,
    sortOrder: Number(plan.sortOrder || 0),
    features: Array.isArray(plan.features) ? plan.features : [],
    // Structured feature gates (Phase 6 model) — persisted as booleans.
    quantityPricing: !!plan.quantityPricing,
    variantInventory: !!plan.variantInventory,
    coupons: !!plan.coupons,
    analytics: plan.analytics !== undefined ? !!plan.analytics : true,
    whatsappAutomation: !!plan.whatsappAutomation,
    // These legacy flags have no product implementation yet. Keep them false
    // so an admin cannot accidentally advertise or grant a phantom feature.
    abandonedCart: false,
    advancedReports: false,
    customDomain: false,
    apiAccess: false,
    removeBranding: false,
    prioritySupport: false,
     storeLimit: Number(plan.storeLimit || 1),
     unlimitedProducts: plan.unlimitedProducts === true,
    unlimitedSalesLinks: plan.unlimitedSalesLinks === true,
    isLaunchOffer: billingModel === 'one_time' ? plan.isLaunchOffer !== false : false,
    isPubliclyAvailable: billingModel === 'one_time' ? plan.isPubliclyAvailable !== false : true,
    launchOfferLimit: billingModel === 'one_time' ? Math.max(0, Number(plan.launchOfferLimit || 0)) : 0,
    launchOfferSoldCount: billingModel === 'one_time' ? Math.max(0, Number(plan.launchOfferSoldCount || 0)) : 0,
    active: plan.active !== false,
    updatedAt: now(),
  }

  if (plan.slug && String(plan.slug).trim()) payload.slug = String(plan.slug).trim()

  // launchExpiresAt is only patched when the caller supplies it (so editing a
  // plan's price alone does not wipe a previously-set expiry). Accepts a date
  // string, a Date, or a Firestore Timestamp.
  if (plan.launchExpiresAt !== undefined) {
    if (plan.launchExpiresAt === null) {
      payload.launchExpiresAt = null
    } else {
      const d = typeof plan.launchExpiresAt === 'string' ? new Date(plan.launchExpiresAt) : (plan.launchExpiresAt as any)?.toDate ? (plan.launchExpiresAt as any).toDate() : new Date(plan.launchExpiresAt)
      payload.launchExpiresAt = tsFromDate(d)
    }
  }
  if (plan.launchOfferEndsAt !== undefined) {
    if (plan.launchOfferEndsAt === null) {
      payload.launchOfferEndsAt = null
    } else {
      const d = typeof plan.launchOfferEndsAt === 'string' ? new Date(plan.launchOfferEndsAt) : (plan.launchOfferEndsAt as any)?.toDate ? (plan.launchOfferEndsAt as any).toDate() : new Date(plan.launchOfferEndsAt)
      payload.launchOfferEndsAt = tsFromDate(d)
    }
  }

  let action: string
  let savedId = planId
  if (planId) {
    // The launch-slot counter is server-maintained. Admin UI can view the
    // count, but an edited form must never reset or forge it.
    const existing = await db.doc(`plans/${planId}`).get()
    if (existing.exists && billingModel === 'one_time') {
      payload.launchOfferSoldCount = Math.max(0, Number(existing.data()?.launchOfferSoldCount || 0))
    }
    await db.doc(`plans/${planId}`).update(payload)
    action = plan.active === false ? 'plan_deactivated' : 'plan_changed'
  } else {
    const ref = await db.collection('plans').add(payload)
    savedId = ref.id
    action = 'plan_created'
  }

  await auditLog(null, request.auth!.uid, action, 'plans', savedId, { name: payload.name, priceMonthly: payload.priceMonthly })

  return { ok: true, planId: savedId }
})

// ─────────────────────────────────────────────────────────────
// 4k2. syncCanonicalPlans — SuperAdmin-only idempotent upsert for the current
//      public M&K pricing catalog. Existing subscriptions keep their snapshots;
//      this only updates live plan documents used for new grants/enforcement.
// ─────────────────────────────────────────────────────────────
export const syncCanonicalPlans = onCall(async (request: CallableRequest) => {
  await assertPlatformAdmin(request)
  const batch = db.batch()
  const existing = await Promise.all(CANONICAL_PLANS.map((plan) => db.doc(`plans/${plan.id}`).get()))
  for (let index = 0; index < CANONICAL_PLANS.length; index += 1) {
    const plan = CANONICAL_PLANS[index]
    const previous = existing[index].data() || {}
    const ref = db.doc(`plans/${plan.id}`)
    batch.set(ref, {
      ...plan,
      launchOfferSoldCount: previous.launchOfferSoldCount ?? (plan as any).launchOfferSoldCount ?? 0,
      abandonedCart: false,
      advancedReports: false,
      customDomain: false,
      apiAccess: false,
      removeBranding: false,
      prioritySupport: false,
      updatedAt: now(),
      syncedFromCatalogAt: now(),
      createdBy: 'canonical-catalog',
    }, { merge: true })
  }
  await batch.commit()
  await auditLog(null, request.auth!.uid, 'canonical_plans_synced', 'plans', 'canonical', {
    planIds: CANONICAL_PLANS.map((p) => p.id),
  })
  return { ok: true, count: CANONICAL_PLANS.length, planIds: CANONICAL_PLANS.map((p) => p.id) }
})

function couponExpiryFromInput(raw: unknown): Timestamp | null {
  if (raw == null || raw === '') return null
  let millis: number | null = null
  if (typeof raw === 'string') {
    // A date input represents the full calendar day in the primary market.
    const normalized = raw.trim()
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? Date.parse(`${normalized}T23:59:59.999+03:00`)
      : Date.parse(normalized)
    millis = Number.isFinite(parsed) ? parsed : null
  } else if (raw instanceof Date) {
    millis = raw.getTime()
  } else if (typeof raw === 'object') {
    const value = raw as { seconds?: unknown; _seconds?: unknown; toMillis?: () => number }
    if (typeof value.toMillis === 'function') millis = value.toMillis()
    else {
      const seconds = typeof value.seconds === 'number' ? value.seconds : value._seconds
      if (typeof seconds === 'number') millis = seconds * 1000
    }
  }
  if (millis == null || !Number.isFinite(millis)) {
    throw new HttpsError('invalid-argument', 'تاريخ انتهاء الكوبون غير صالح')
  }
  return Timestamp.fromMillis(millis)
}

function isPlatformIssuedCoupon(coupon: Record<string, unknown>) {
  return coupon.source === 'platform' || coupon.createdByRole === 'superAdmin'
}

// Coupon mutations are callable-only so plan entitlements cannot be bypassed
// through a direct Firestore write. Platform admins retain their platform-wide
// authority; merchants and staff need both the role permission and coupons
// entitlement on the store's active plan.
export const manageCoupon = onCall(async (request: CallableRequest<{
  operation?: 'create' | 'update' | 'delete'
  storeId?: string
  couponId?: string
  coupon?: Record<string, unknown>
}>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { operation, storeId, couponId, coupon = {} } = request.data || {}
  if (!storeId || !operation) throw new HttpsError('invalid-argument', 'بيانات الكوبون غير مكتملة')
  await assertStoreAccess(request, storeId, 'coupons:manage')

  const actor = await db.doc(`users/${request.auth.uid}`).get()
  const isPlatformAdmin = actor.data()?.role === 'superAdmin'
  const grant = isPlatformAdmin ? null : await grantForStore(storeId, request.auth.uid)
  const couponsEnabled = isPlatformAdmin || Boolean(grant && canUseFeature(grant.plan, 'coupons'))

  if (operation === 'create') {
    if (!couponsEnabled) throw new HttpsError('resource-exhausted', 'ميزة الكوبونات متاحة بدايةً من خطة Starter. قم بترقية خطتك للمتابعة.')
    const code = String(coupon.code || '').trim().toUpperCase()
    const type = coupon.type === 'fixed' ? 'fixed' : 'percent'
    const value = Number(coupon.value || 0)
    if (!code || !Number.isFinite(value) || value <= 0) {
      throw new HttpsError('invalid-argument', 'أدخل كوداً وقيمة صالحة للكوبون')
    }
    if (type === 'percent' && value > 100) throw new HttpsError('invalid-argument', 'لا يمكن أن تتجاوز النسبة 100%')
    const duplicate = await db.collection('coupons')
      .where('storeId', '==', storeId)
      .where('code', '==', code)
      .limit(1)
      .get()
    if (!duplicate.empty) throw new HttpsError('already-exists', 'كود الخصم مستخدم بالفعل في هذا المتجر')
    const expiresAt = couponExpiryFromInput(coupon.expiresAt)
    if (expiresAt && expiresAt.toMillis() <= Date.now()) {
      throw new HttpsError('invalid-argument', 'اختر تاريخ انتهاء في المستقبل أو اتركه فارغاً')
    }
    const ref = db.collection('coupons').doc()
    await ref.set({
      storeId,
      code,
      type,
      value,
      minOrder: Math.max(0, Number(coupon.minOrder || 0)),
      maxUses: Math.max(0, Number(coupon.maxUses || 0)),
      usedCount: 0,
      active: coupon.active !== false,
      ...(expiresAt ? { expiresAt } : {}),
      source: isPlatformAdmin ? 'platform' : 'merchant',
      createdByRole: isPlatformAdmin ? 'superAdmin' : (actor.data()?.role === 'staff' ? 'staff' : 'merchant'),
      createdAt: now(),
      updatedAt: now(),
      createdBy: request.auth.uid,
    })
    await auditLog(storeId, request.auth.uid, 'coupon_created', 'coupons', ref.id, { code })
    return { ok: true, couponId: ref.id }
  }

  if (!couponId) throw new HttpsError('invalid-argument', 'couponId مطلوب')
  const ref = db.doc(`coupons/${couponId}`)
  const existingSnap = await ref.get()
  if (!existingSnap.exists || existingSnap.data()?.storeId !== storeId) {
    throw new HttpsError('not-found', 'الكوبون غير موجود ضمن هذا المتجر')
  }

  const existing = existingSnap.data() || {}
  if (!isPlatformAdmin && isPlatformIssuedCoupon(existing)) {
    throw new HttpsError('permission-denied', 'هذا كوبون أضافته إدارة المنصة ويمكنك استخدامه ومتابعة نتائجه فقط')
  }

  if (operation === 'delete') {
    await ref.delete()
    await auditLog(storeId, request.auth.uid, 'coupon_deleted', 'coupons', couponId)
    return { ok: true }
  }

  if (operation !== 'update') throw new HttpsError('invalid-argument', 'عملية الكوبون غير صالحة')
  if (coupon.active === true && !couponsEnabled) {
    throw new HttpsError('resource-exhausted', 'ميزة الكوبونات متاحة بدايةً من خطة Starter. قم بترقية خطتك للمتابعة.')
  }
  const changes: Record<string, unknown> = { updatedAt: now() }
  if (coupon.active != null) changes.active = coupon.active === true
  if (coupon.code != null) {
    const code = String(coupon.code).trim().toUpperCase()
    if (!code) throw new HttpsError('invalid-argument', 'كود الخصم مطلوب')
    const duplicate = await db.collection('coupons')
      .where('storeId', '==', storeId)
      .where('code', '==', code)
      .limit(2)
      .get()
    if (duplicate.docs.some((doc) => doc.id !== couponId)) {
      throw new HttpsError('already-exists', 'كود الخصم مستخدم بالفعل في هذا المتجر')
    }
    changes.code = code
  }
  if (coupon.type != null) changes.type = coupon.type === 'fixed' ? 'fixed' : 'percent'
  for (const key of ['value', 'minOrder', 'maxUses'] as const) {
    if (coupon[key] != null) {
      const value = Number(coupon[key])
      if (!Number.isFinite(value) || value < 0) throw new HttpsError('invalid-argument', 'قيمة الكوبون غير صالحة')
      changes[key] = value
    }
  }
  if (changes.type === 'percent' && Number(changes.value || existingSnap.data()?.value || 0) > 100) {
    throw new HttpsError('invalid-argument', 'لا يمكن أن تتجاوز النسبة 100%')
  }
  if (coupon.expiresAt !== undefined) {
    const expiresAt = couponExpiryFromInput(coupon.expiresAt)
    if (expiresAt && expiresAt.toMillis() <= Date.now()) {
      throw new HttpsError('invalid-argument', 'اختر تاريخ انتهاء في المستقبل أو اتركه فارغاً')
    }
    changes.expiresAt = expiresAt || FieldValue.delete()
  }
  await ref.update(changes)
  await auditLog(storeId, request.auth.uid, 'coupon_updated', 'coupons', couponId)
  return { ok: true }
})

// Public coupon preview. It never exposes the coupon collection and never
// increments usage; createOrder repeats the validation transactionally.
export const quoteCoupon = onCall(async (request: CallableRequest<{ storeId?: string; code?: string; subtotal?: number }>) => {
  const { storeId, code, subtotal } = request.data || {}
  const normalized = String(code || '').trim().toUpperCase()
  const amount = Number(subtotal || 0)
  if (!storeId || !normalized || !Number.isFinite(amount) || amount < 0) {
    throw new HttpsError('invalid-argument', 'بيانات الكوبون غير مكتملة')
  }
  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active || storePublicationStatus(storeSnap.data()) !== 'published') {
    throw new HttpsError('failed-precondition', 'المتجر لا يقبل الطلبات حاليًا')
  }
  const snap = await db.collection('coupons')
    .where('storeId', '==', storeId)
    .where('code', '==', normalized)
    .limit(1)
    .get()
  if (snap.empty) throw new HttpsError('failed-precondition', 'كود الخصم غير صالح')
  const coupon = snap.docs[0].data()
  if (coupon.active !== true) throw new HttpsError('failed-precondition', 'كود الخصم غير نشط')
  const grant = await grantForStore(storeId, request.auth?.uid)
  if (!grant) throw new HttpsError('failed-precondition', 'الاشتراك غير نشط — المتجر لا يقبل الطلبات حالياً')
  if (!isPlatformIssuedCoupon(coupon) && !canUseFeature(grant.plan, 'coupons')) {
    throw new HttpsError('failed-precondition', 'الكوبونات غير متاحة في باقة هذا المتجر')
  }
  const expiresAt = coupon.expiresAt
  const expiryMs = expiresAt?.toMillis ? expiresAt.toMillis() : expiresAt?.seconds ? Number(expiresAt.seconds) * 1000 : null
  if (expiryMs && expiryMs <= Date.now()) throw new HttpsError('failed-precondition', 'انتهت صلاحية كود الخصم')
  if (Number(coupon.maxUses || 0) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.maxUses)) {
    throw new HttpsError('failed-precondition', 'اكتمل استخدام كود الخصم')
  }
  if (Number(coupon.minOrder || 0) > amount) throw new HttpsError('failed-precondition', 'الطلب لا يحقق الحد الأدنى للكوبون')
  const value = Number(coupon.value || 0)
  const discount = coupon.type === 'fixed' ? Math.min(amount, value) : Math.min(amount, amount * Math.min(100, value) / 100)
  if (discount <= 0) throw new HttpsError('failed-precondition', 'قيمة كود الخصم غير صالحة')
  return { code: normalized, discount, subtotal: amount }
})

// Only campaigns created by the platform are intentionally discoverable to
// shoppers. Merchant-created codes remain private and are entered manually.
export const getPublicStoreCoupons = onCall(async (request: CallableRequest<{ storeId?: string }>) => {
  const storeId = String(request.data?.storeId || '')
  if (!storeId) throw new HttpsError('invalid-argument', 'معرّف المتجر مطلوب')
  const store = await db.doc(`stores/${storeId}`).get()
  if (!store.exists || !store.data()?.active || storePublicationStatus(store.data()) !== 'published') {
    throw new HttpsError('failed-precondition', 'المتجر لا يقبل الطلبات حاليًا')
  }
  const nowMs = Date.now()
  const coupons = (await db.collection('coupons').where('storeId', '==', storeId).get()).docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((coupon: any) => {
      const expiry = coupon.expiresAt?.toMillis ? coupon.expiresAt.toMillis() : coupon.expiresAt?.seconds ? Number(coupon.expiresAt.seconds) * 1000 : null
      return isPlatformIssuedCoupon(coupon) && coupon.active === true && (!expiry || expiry > nowMs) && (!Number(coupon.maxUses || 0) || Number(coupon.usedCount || 0) < Number(coupon.maxUses || 0))
    })
    .slice(0, 6)
    .map((coupon: any) => ({ code: coupon.code, type: coupon.type, value: Number(coupon.value || 0), minOrder: Number(coupon.minOrder || 0) }))
  return { coupons }
})

const TENANT_COLLECTIONS = [
  'subscriptions',
  'storePurchaseRequests',
  'subscriptionChangeRequests',
  'subscriptionPayments',
  'transactions',
  'payments',
  'orders',
  'orderCosts',
  'products',
  'productCosts',
  'categories',
  'customers',
  'coupons',
  'shipping',
  'storeShippingProviders',
  'shipments',
  'shippingCompanyReviews',
  'storeLinks',
  'landingPages',
  'analytics',
  'notifications',
  'tickets',
  'auditLogs',
  'team',
  'roles',
  'invitations',
]

const MERCHANT_DELETE_COLLECTIONS = Array.from(new Set([
  ...TENANT_COLLECTIONS,
  'shippingConfigs',
  'merchantAnalytics',
  'merchantNotifications',
  'merchantTickets',
  'usageCounters',
]))

const MERCHANT_DELETE_CONFIRMATION = 'حذف نهائي'

type MerchantDeletionContext = {
  merchantId: string
  merchantName: string
  merchantEmail: string
  storeIds: string[]
  storeNames: Record<string, string>
}

type MerchantDeletionCounts = Record<string, number> & {
  authUsers: number
  stores: number
  storageFiles: number
  storageBytes: number
}

async function getMerchantDeletionContext(merchantId: string): Promise<MerchantDeletionContext> {
  const userSnap = await db.doc(`users/${merchantId}`).get()
  const jobSnap = await db.doc(`merchantDeletionJobs/${merchantId}`).get()
  if (!userSnap.exists) {
    if (jobSnap.exists) {
      const job = jobSnap.data() || {}
      return {
        merchantId,
        merchantName: String(job.merchantName || ''),
        merchantEmail: String(job.merchantEmail || ''),
        storeIds: Array.isArray(job.storeIds) ? job.storeIds : [],
        storeNames: job.storeNames || {},
      }
    }
    throw new HttpsError('not-found', 'التاجر غير موجود')
  }
  const user = userSnap.data() || {}
  if (user.role === 'superAdmin' || user.role === 'platformAdmin' || user.systemAccount === true) {
    throw new HttpsError('failed-precondition', 'لا يمكن حذف حساب إدارة أو حساب نظام')
  }
  if (user.role !== 'merchant') throw new HttpsError('failed-precondition', 'الحساب المحدد ليس حساب تاجر')

  const ownedStores = await db.collection('stores').where('ownerId', '==', merchantId).get()
  const storeIds = Array.from(new Set([
    ...ownedStores.docs.map((doc) => doc.id),
    ...(Array.isArray(user.storeIds) ? user.storeIds.filter((id: unknown): id is string => typeof id === 'string') : []),
  ])).sort()
  const storeNames: Record<string, string> = {}
  for (const storeId of storeIds) {
    const owned = ownedStores.docs.find((doc) => doc.id === storeId)
    const snap = owned || await db.doc(`stores/${storeId}`).get()
    if (snap.exists && snap.data()?.ownerId === merchantId) storeNames[storeId] = String(snap.data()?.name || storeId)
  }
  const verifiedStoreIds = storeIds.filter((id) => Object.prototype.hasOwnProperty.call(storeNames, id))
  return {
    merchantId,
    merchantName: String(user.name || user.displayName || ''),
    merchantEmail: String(user.email || ''),
    storeIds: verifiedStoreIds,
    storeNames,
  }
}

async function countCollectionDocs(collectionName: string, storeIds: string[]): Promise<number> {
  let total = 0
  for (const storeId of storeIds) {
    try {
      const result = await db.collection(collectionName).where('storeId', '==', storeId).count().get()
      total += Number(result.data()?.count || 0)
    } catch {
      total += (await db.collection(collectionName).where('storeId', '==', storeId).get()).size
    }
  }
  return total
}

async function merchantStorageInventory(storeIds: string[]): Promise<{ files: number; bytes: number }> {
  const bucket = admin.storage().bucket(STORAGE_BUCKET)
  let files = 0
  let bytes = 0
  for (const storeId of storeIds) {
    const prefixes = [`stores/${storeId}/`, `products/${storeId}/`, `landingPages/${storeId}/`, `documents/${storeId}/`]
    for (const prefix of prefixes) {
      const [objects] = await bucket.getFiles({ prefix })
      files += objects.length
      for (const object of objects) {
        const [metadata] = await object.getMetadata()
        bytes += Number(metadata.size || 0)
      }
    }
  }
  return { files, bytes }
}

async function merchantAuthUsers(context: MerchantDeletionContext): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const users = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  const owner = await db.doc(`users/${context.merchantId}`).get()
  if (owner.exists) users.set(owner.id, owner as FirebaseFirestore.QueryDocumentSnapshot)
  for (const storeId of context.storeIds) {
    const snap = await db.collection('users').where('storeIds', 'array-contains', storeId).get()
    for (const doc of snap.docs) users.set(doc.id, doc)
  }
  return Array.from(users.values()).filter((doc) => {
    const data = doc.data() || {}
    if (data.role === 'superAdmin' || data.role === 'platformAdmin' || data.systemAccount === true) return false
    if (doc.id === context.merchantId) return true
    if (data.role !== 'staff') return false
    const memberships = Array.isArray(data.storeIds) ? data.storeIds : []
    return memberships.length > 0 && memberships.every((id: string) => context.storeIds.includes(id))
  })
}

async function buildMerchantDeletionPreview(context: MerchantDeletionContext): Promise<MerchantDeletionCounts> {
  const counts: MerchantDeletionCounts = { authUsers: 0, stores: context.storeIds.length, storageFiles: 0, storageBytes: 0 }
  const entries = await Promise.all(MERCHANT_DELETE_COLLECTIONS.map(async (name) => [name, await countCollectionDocs(name, context.storeIds)] as const))
  for (const [name, count] of entries) counts[name] = count
  counts.authUsers = (await merchantAuthUsers(context)).length
  const storage = await merchantStorageInventory(context.storeIds)
  counts.storageFiles = storage.files
  counts.storageBytes = storage.bytes
  return counts
}

async function markMerchantLifecycle(context: MerchantDeletionContext, status: 'suspended' | 'active' | 'deleting') {
  const batch = db.batch()
  const ownerRef = db.doc(`users/${context.merchantId}`)
  const owner = await ownerRef.get()
  if (owner.exists) batch.set(ownerRef, {
    active: status === 'active',
    merchantStatus: status,
    updatedAt: now(),
  }, { merge: true })
  for (const storeId of context.storeIds) {
    const storeRef = db.doc(`stores/${storeId}`)
    const store = await storeRef.get()
    if (!store.exists || store.data()?.ownerId !== context.merchantId) continue
    batch.set(storeRef, {
      merchantSuspended: status !== 'active',
      merchantLifecycleStatus: status,
      updatedAt: now(),
    }, { merge: true })
  }
  await batch.commit()
}

export const suspendMerchant = onCall(async (request: CallableRequest<{ merchantId?: string }>) => {
  await assertPlatformAdmin(request)
  const merchantId = String(request.data?.merchantId || '').trim()
  if (!merchantId) throw new HttpsError('invalid-argument', 'merchantId مطلوب')
  const context = await getMerchantDeletionContext(merchantId)
  await markMerchantLifecycle(context, 'suspended')
  await auditLog(null, request.auth!.uid, 'merchant_suspended', 'users', merchantId, { storeIds: context.storeIds })
  return { ok: true, merchantId, status: 'suspended' }
})

export const reactivateMerchant = onCall(async (request: CallableRequest<{ merchantId?: string }>) => {
  await assertPlatformAdmin(request)
  const merchantId = String(request.data?.merchantId || '').trim()
  if (!merchantId) throw new HttpsError('invalid-argument', 'merchantId مطلوب')
  const context = await getMerchantDeletionContext(merchantId)
  const job = await db.doc(`merchantDeletionJobs/${merchantId}`).get()
  if (job.exists && ['deleting', 'deleted'].includes(String(job.data()?.status || ''))) {
    throw new HttpsError('failed-precondition', 'لا يمكن إعادة تفعيل تاجر قيد الحذف أو محذوف')
  }
  await markMerchantLifecycle(context, 'active')
  await auditLog(null, request.auth!.uid, 'merchant_reactivated', 'users', merchantId, { storeIds: context.storeIds })
  return { ok: true, merchantId, status: 'active' }
})

export const getMerchantDeletionPreview = onCall(async (request: CallableRequest<{ merchantId?: string }>) => {
  await assertPlatformAdmin(request)
  const merchantId = String(request.data?.merchantId || '').trim()
  if (!merchantId) throw new HttpsError('invalid-argument', 'merchantId مطلوب')
  const job = await db.doc(`merchantDeletionJobs/${merchantId}`).get()
  if (job.exists && job.data()?.status === 'deleted') {
    return { status: 'already_deleted', merchantId, summary: job.data()?.summary || {} }
  }
  const context = await getMerchantDeletionContext(merchantId)
  const counts = await buildMerchantDeletionPreview(context)
  return { status: job.exists ? job.data()?.status : 'ready', ...context, counts, confirmation: MERCHANT_DELETE_CONFIRMATION }
})

async function deleteMerchantStorage(context: MerchantDeletionContext): Promise<{ files: number; bytes: number }> {
  const bucket = admin.storage().bucket(STORAGE_BUCKET)
  let files = 0
  let bytes = 0
  for (const storeId of context.storeIds) {
    const prefixes = [`stores/${storeId}/`, `products/${storeId}/`, `landingPages/${storeId}/`, `documents/${storeId}/`]
    for (const prefix of prefixes) {
      const [objects] = await bucket.getFiles({ prefix })
      for (const object of objects) {
        const [metadata] = await object.getMetadata()
        await object.delete({ ignoreNotFound: true })
        files++
        bytes += Number(metadata.size || 0)
      }
    }
  }
  return { files, bytes }
}

async function deleteDocsByField(collectionName: string, field: string, values: string[]): Promise<number> {
  let deleted = 0
  for (const value of values) {
    const snap = await db.collection(collectionName).where(field, '==', value).get()
    const docs = [...snap.docs]
    while (docs.length) {
      const batch = db.batch()
      for (const doc of docs.splice(0, 400)) {
        batch.delete(doc.ref)
        deleted++
      }
      await batch.commit()
    }
  }
  return deleted
}

export const permanentlyDeleteMerchant = onCall(async (request: CallableRequest<{ merchantId?: string; confirmation?: string }>) => {
  await assertPlatformAdmin(request)
  const merchantId = String(request.data?.merchantId || '').trim()
  if (!merchantId) throw new HttpsError('invalid-argument', 'merchantId مطلوب')
  if (request.data?.confirmation !== MERCHANT_DELETE_CONFIRMATION) throw new HttpsError('invalid-argument', 'نص التأكيد غير صحيح')

  const jobRef = db.doc(`merchantDeletionJobs/${merchantId}`)
  const existingJob = await jobRef.get()
  if (existingJob.exists && existingJob.data()?.status === 'deleted') {
    return { ok: true, status: 'already_deleted', summary: existingJob.data()?.summary || {} }
  }
  const existingUpdatedAt = existingJob.data()?.updatedAt
  const existingUpdatedMs = typeof existingUpdatedAt?.toMillis === 'function' ? existingUpdatedAt.toMillis() : 0
  if (existingJob.exists && existingJob.data()?.status === 'deleting' && Date.now() - existingUpdatedMs < 15 * 60 * 1000) {
    return { ok: true, status: 'already_deleting', summary: existingJob.data()?.summary || {} }
  }
  const context = await getMerchantDeletionContext(merchantId)
  const owner = await db.doc(`users/${merchantId}`).get()
  if (owner.exists) {
    const data = owner.data() || {}
    if (data.role === 'superAdmin' || data.role === 'platformAdmin' || data.systemAccount === true) {
      throw new HttpsError('failed-precondition', 'لا يمكن حذف حساب إدارة أو حساب نظام')
    }
  }

  const preview = await buildMerchantDeletionPreview(context)
  const reservation = await db.runTransaction(async (tx) => {
    const current = await tx.get(jobRef)
    const status = String(current.data()?.status || '')
    if (status === 'deleted') return 'already_deleted'
    const updatedAt = current.data()?.updatedAt
    const updatedMs = typeof updatedAt?.toMillis === 'function' ? updatedAt.toMillis() : 0
    if (status === 'deleting' && Date.now() - updatedMs < 15 * 60 * 1000) return 'already_deleting'
    tx.set(jobRef, {
      status: 'deleting',
      ...context,
      preview,
      actorUid: request.auth!.uid,
      startedAt: current.exists ? (current.data()?.startedAt || now()) : now(),
      updatedAt: now(),
      lastError: FieldValue.delete(),
    }, { merge: true })
    return 'acquired'
  })
  if (reservation !== 'acquired') {
    const current = await jobRef.get()
    return { ok: true, status: reservation, summary: current.data()?.summary || {} }
  }

  try {
    await markMerchantLifecycle(context, 'deleting')
    const summary: Record<string, number> = {}
    for (const collectionName of MERCHANT_DELETE_COLLECTIONS) {
      summary[collectionName] = 0
      for (const storeId of context.storeIds) summary[collectionName] += await deleteCollectionDocs(collectionName, storeId)
    }
    summary.notificationsByUser = await deleteDocsByField('notifications', 'userId', [merchantId])
    summary.ticketsByUser = await deleteDocsByField('tickets', 'createdBy', [merchantId])
    summary.reviewsByMerchant = await deleteDocsByField('shippingCompanyReviews', 'merchantId', [merchantId])

    for (const storeId of context.storeIds) {
      await db.recursiveDelete(db.doc(`publicStores/${storeId}`))
      await db.recursiveDelete(db.doc(`stores/${storeId}`))
    }
    const storage = await deleteMerchantStorage(context)
    summary.storageFiles = storage.files
    summary.storageBytes = storage.bytes

    const authUsers = await merchantAuthUsers(context)
    summary.authUsers = 0
    for (const userDoc of authUsers) {
      const uid = String(userDoc.data()?.uid || userDoc.id)
      await auth.deleteUser(uid).catch((error: any) => {
        if (error?.code !== 'auth/user-not-found') throw error
      })
      await userDoc.ref.delete()
      summary.authUsers++
    }
    await db.doc(`users/${merchantId}`).delete().catch(() => {})

    await auditLog(null, request.auth!.uid, 'merchant_permanently_deleted', 'users', merchantId, {
      merchantEmail: context.merchantEmail,
      merchantName: context.merchantName,
      storeIds: context.storeIds,
      deletionSummary: summary,
    })
    await jobRef.set({ status: 'deleted', summary, completedAt: now(), updatedAt: now(), lastError: FieldValue.delete() }, { merge: true })
    return { ok: true, status: 'deleted', summary }
  } catch (error: any) {
    await jobRef.set({
      status: 'deletion_failed',
      lastError: String(error?.code || error?.message || 'unknown').slice(0, 300),
      failedAt: now(),
      updatedAt: now(),
    }, { merge: true }).catch(() => {})
    throw new HttpsError('internal', 'تعذر إكمال حذف التاجر. بقي الحساب محظورًا ويمكن إعادة المحاولة بأمان.')
  }
})

async function deleteTenantStorage(storeId: string): Promise<number> {
  const bucket = admin.storage().bucket(STORAGE_BUCKET)
  const prefixes = [`stores/${storeId}/`, `products/${storeId}/`, `landingPages/${storeId}/`, `documents/${storeId}/`]
  let deleted = 0
  for (const prefix of prefixes) {
    const [files] = await bucket.getFiles({ prefix }).catch(() => [[] as any[]])
    if (!files.length) continue
    await Promise.all(files.map((file: any) => file.delete().then(() => { deleted++ }).catch(() => {})))
  }
  return deleted
}

async function deleteMarkedTestMerchant(storeId: string, actorUid: string): Promise<{ storeId: string; deletedDocs: number; deletedFiles: number; ownerId: string | null }> {
  const storeRef = db.doc(`stores/${storeId}`)
  const storeSnap = await storeRef.get()
  if (!storeSnap.exists) throw new HttpsError('not-found', 'المتجر غير موجود')
  const store = storeSnap.data()!
  if (store.isTestMerchant !== true) {
    throw new HttpsError('failed-precondition', 'لا يمكن حذف هذا المتجر لأنه غير محدد كمتجر اختباري')
  }

  const ownerId = store.ownerId || null
  let deletedDocs = 0
  for (const collectionName of TENANT_COLLECTIONS) {
    deletedDocs += await deleteCollectionDocs(collectionName, storeId)
  }
  for (const subcollection of ['billingSnapshots', 'usageAlerts']) {
    deletedDocs += await deleteStoreSubcollectionDocs(storeId, subcollection)
  }

  const userSnap = await db.collection('users').where('storeIds', 'array-contains', storeId).get()
  for (const userDoc of userSnap.docs) {
    const user = userDoc.data()
    if (user.role === 'superAdmin') continue
    const remainingStoreIds = Array.isArray(user.storeIds)
      ? user.storeIds.filter((id: unknown) => id !== storeId)
      : []
    if (remainingStoreIds.length > 0) {
      await userDoc.ref.update({ storeIds: remainingStoreIds, updatedAt: now() })
      continue
    }
    await userDoc.ref.delete()
    deletedDocs++
    if (user.uid) await auth.deleteUser(user.uid).catch(() => {})
  }

  const deletedFiles = await deleteTenantStorage(storeId)
  await storeRef.delete()
  deletedDocs++
  await auditLog(null, actorUid, 'delete_test_merchant', 'stores', storeId, { ownerId, deletedDocs, deletedFiles })
  return { storeId, deletedDocs, deletedFiles, ownerId }
}

export const deleteTestMerchant = onCall(async (request: CallableRequest<{ storeId?: string; confirmation?: string }>) => {
  await assertPlatformAdmin(request)
  const { storeId, confirmation } = request.data || {}
  if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')
  if (confirmation !== 'Delete merchant and all associated test data?') {
    throw new HttpsError('invalid-argument', 'نص التأكيد غير صحيح')
  }
  return deleteMarkedTestMerchant(storeId, request.auth!.uid)
})

export const deleteSelectedTestMerchants = onCall(async (request: CallableRequest<{ storeIds?: string[]; confirmation?: string }>) => {
  await assertPlatformAdmin(request)
  const storeIds = Array.isArray(request.data?.storeIds) ? request.data.storeIds.filter((id) => typeof id === 'string' && id.trim()) : []
  if (request.data?.confirmation !== 'DELETE SELECTED TEST MERCHANTS') {
    throw new HttpsError('invalid-argument', 'نص التأكيد غير صحيح')
  }
  if (storeIds.length === 0) throw new HttpsError('invalid-argument', 'اختر متجراً اختبارياً واحداً على الأقل')
  if (storeIds.length > 50) throw new HttpsError('invalid-argument', 'لا يمكن حذف أكثر من 50 متجراً في عملية واحدة')

  const results = []
  for (const storeId of Array.from(new Set(storeIds))) {
    results.push(await deleteMarkedTestMerchant(storeId, request.auth!.uid))
  }
  await auditLog(null, request.auth!.uid, 'delete_selected_test_merchants', 'stores', 'test-merchants', { count: results.length, storeIds })
  return { ok: true, count: results.length, results }
})

// ─────────────────────────────────────────────────────────────
// 4c. getPlatformOverview — platform admin operational snapshot.
//     Returns every store joined with its latest subscription, plan and
//     owner, plus the live order-usage metrics used by the Super Admin UI.
// ─────────────────────────────────────────────────────────────
export const getPlatformOverview = onCall(async (request: CallableRequest) => {
  await assertPlatformAdmin(request)

  const [storesSnap, subsSnap, plansSnap, usersSnap, productsSnap] = await Promise.all([
    db.collection('stores').get(),
    db.collection('subscriptions').get(),
    db.collection('plans').get(),
    db.collection('users').get(),
    db.collection('products').get(),
  ])

  const plans = new Map<string, any>()
  for (const d of plansSnap.docs) plans.set(d.id, d.data())

  const users = new Map<string, any>()
  for (const d of usersSnap.docs) {
    const u = d.data()
    users.set(u.uid || d.id, u)
  }

  const productsByStore = new Map<string, number>()
  for (const d of productsSnap.docs) {
    const p = d.data()
    if (!p.storeId) continue
    productsByStore.set(p.storeId, (productsByStore.get(p.storeId) || 0) + 1)
  }

  // Resolve one effective subscription per store. The store pointer is
  // canonical; the status/paid fallbacks are only for repairing legacy local
  // records and must never let a newly-created FREE row hide a paid snapshot.
  const subscriptionsByStore = new Map<string, { id: string; data: any }[]>()
  for (const d of subsSnap.docs) {
    const s = d.data()
    const list = subscriptionsByStore.get(s.storeId) || []
    list.push({ id: d.id, data: s })
    subscriptionsByStore.set(s.storeId, list)
  }

  // Payment requests for the "pending payment" + payments metrics.
  const paySnap = await db.collection('subscriptionPayments').get()
  const pendingPayments = paySnap.docs.filter((d) => d.data()?.status === 'pending').map((d) => ({ id: d.id, ...d.data() }))

  const rows = storesSnap.docs.map((d) => {
    const store = d.data()
    const storeId = d.id
    const candidates = (subscriptionsByStore.get(storeId) || []).sort((a, b) => (b.data.createdAt?.seconds || 0) - (a.data.createdAt?.seconds || 0))
    const pointed = store.activeSubscriptionId ? candidates.find((s) => s.id === store.activeSubscriptionId) : null
    const effective = candidates.filter((s) => ['active', 'trialing'].includes(resolveSubscriptionStatus(s.data)))
    const paid = effective.find((s) => (s.data.billingModel === 'one_time' && s.data.ownershipType === 'lifetime' && s.data.lifetimeAccess === true) || Number(s.data.normalPriceSnapshot ?? s.data.priceSnapshot ?? 0) > 0)
    const subEntry = (paid && (!pointed || Number(pointed.data.normalPriceSnapshot ?? pointed.data.priceSnapshot ?? 0) <= 0)) || !pointed
      ? (paid || effective[0] || candidates[0])
      : pointed
    const sub = subEntry?.data || null
    const resolvedStatus = sub ? resolveSubscriptionStatus(sub) : null
    const plan = sub ? plans.get(sub.planId) : null
    const orderLimit = Number(plan?.orderLimitPerMonth || 0)
    const ordersUsed = Number(sub?.ordersUsed || 0)
    const remaining = orderLimit > 0 ? Math.max(0, orderLimit - ordersUsed) : null
    const usagePercent = orderLimit > 0 ? Math.min(100, Math.round((ordersUsed / orderLimit) * 100)) : 0

    let usageLevel: string = 'none'
    if (orderLimit > 0) {
      if (ordersUsed >= orderLimit) usageLevel = 'reached'
      else if (usagePercent >= 90) usageLevel = 'near'
      else if (usagePercent >= 80) usageLevel = 'approaching'
      else if (usagePercent >= 60) usageLevel = 'moderate'
      else usageLevel = 'normal'
    }

    const owner = store.ownerId ? users.get(store.ownerId) : null
    const pendingPayment = pendingPayments.some((p: any) => p.subscriptionId === subEntry?.id)

    return {
      storeId,
      storeName: store.name || '—',
      ref: store.ref || '',
      slug: store.slug || '',
      // Store publication/activation is separate from merchant approval. A
      // newly registered store may have active=true for legacy compatibility,
      // but it must still appear as pending while the owner is unapproved.
      active: !!store.active && owner?.active !== false && (!owner?.merchantStatus || owner.merchantStatus === 'active'),
      merchantStatus: owner?.merchantStatus || (owner?.active === false ? 'pending_approval' : 'active'),
      storeStatus: storePublicationStatus(store),
      published: storePublicationStatus(store) === 'published',
      isTestMerchant: store.isTestMerchant === true,
      createdAt: store.createdAt || null,
      ownerId: store.ownerId || null,
      ownerName: owner?.name || null,
      ownerEmail: owner?.email || null,
      ownerRole: owner?.role || null,
      subId: subEntry?.id || null,
      planId: sub?.planId || null,
      planName: plan?.name || sub?.planName || null,
      planPriceMonthly: Number(plan?.priceMonthly || 0),
      productLimit: Number(plan?.productLimit || 0),
      productsUsed: productsByStore.get(storeId) || 0,
      storageUsed: Number(store.storageUsed || 0),
      storageLimitBytes: Number(store.storageLimitBytes || Number(plan?.storageLimit || 0) * 1024 * 1024),
      subStatus: resolvedStatus,
      subStartedAt: sub?.startedAt || null,
      subExpiresAt: sub?.expiresAt || null,
      trialStartedAt: sub?.trialStartedAt || null,
      trialEndsAt: sub?.trialEndsAt || null,
      activatedAt: sub?.activatedAt || null,
      currentPeriodStart: sub?.currentPeriodStart || null,
      currentPeriodEnd: sub?.currentPeriodEnd || null,
      firstMonthPrice: Number(sub?.launchPriceSnapshot || 0),
      normalPriceSnapshot: Number(sub?.normalPriceSnapshot || 0),
      launchUsed: !!sub?.launchUsed,
      periodNumber: Number(sub?.periodNumber || 0),
      pendingPayment,
      orderLimit,
      ordersUsed,
      remaining,
      usagePercent,
      usageLevel,
    }
  })

  const activeSubs = rows.filter((r) => r.subStatus === 'active')
  const mrr = activeSubs.reduce((s, r) => s + (r.normalPriceSnapshot || r.planPriceMonthly || 0), 0)
  const metrics = {
    totalMerchants: rows.length,
    activeStores: rows.filter((r) => r.active).length,
    trialing: rows.filter((r) => r.subStatus === 'trialing').length,
    activeSubscriptions: activeSubs.length,
    expired: rows.filter((r) => r.subStatus === 'expired').length,
    suspended: rows.filter((r) => r.subStatus === 'suspended').length,
    cancelled: rows.filter((r) => r.subStatus === 'cancelled').length,
    pendingPaymentRequests: pendingPayments.length,
    launchActivations: rows.filter((r) => r.launchUsed).length,
    nearLimit: rows.filter((r) => r.usageLevel === 'near' || r.usageLevel === 'approaching').length,
    reachedLimit: rows.filter((r) => r.usageLevel === 'reached').length,
    mrr,
  }

  return { rows, metrics }
})

// ─────────────────────────────────────────────────────────────
// Shipment marketplace — quotes, immutable attempts, and verified reviews.
// ─────────────────────────────────────────────────────────────
export const saveShippingProvider = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request)
  const raw = request.data || {}
  if (raw.credentials || raw.apiKey || raw.secret || raw.webhookSecret || raw.token) {
    throw new HttpsError('invalid-argument', 'لا تُرسل الأسرار عبر واجهة المتصفح')
  }
  const payload = normalizeShippingProviderPayload(raw.provider || raw)
  const providerId = String(raw.providerId || '').trim()
  const duplicate = await db.collection('shippingProviders').where('slug', '==', payload.slug).limit(2).get()
  const duplicateDoc = duplicate.docs.find((doc) => doc.id !== providerId)
  if (duplicateDoc) throw new HttpsError('already-exists', 'مفتاح شركة الشحن مستخدم مسبقاً')
  const ref = providerId ? db.doc(`shippingProviders/${providerId}`) : db.collection('shippingProviders').doc()
  const existing = providerId ? await ref.get() : null
  const data = { ...payload, id: ref.id, createdAt: existing?.exists ? existing.data()?.createdAt : now(), updatedAt: now(), createdBy: request.auth!.uid }
  await ref.set(data, { merge: true })
  return { provider: safeShippingProvider(ref.id, data) }
})

export const setShippingProviderStatus = onCall(async (request: CallableRequest<{ providerId?: string; status?: string }>) => {
  await assertPlatformAdmin(request)
  const providerId = String(request.data?.providerId || '').trim()
  const status = request.data?.status
  if (!providerId || !SHIPPING_PROVIDER_STATUSES.includes(status as any)) throw new HttpsError('invalid-argument', 'بيانات حالة شركة الشحن غير صالحة')
  const ref = db.doc(`shippingProviders/${providerId}`)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'شركة الشحن غير موجودة')
  await ref.update({ status, updatedAt: now() })
  return { ok: true, provider: safeShippingProvider(providerId, { ...snap.data(), status }) }
})

export const getMerchantShippingProviders = onCall(async (request: CallableRequest<{ storeId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = String(request.data?.storeId || '').trim()
  if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')
  await assertStoreAccess(request, storeId, 'settings:view')
  const [providersSnap, configsSnap, credentialsSnap, settingsSnap] = await Promise.all([
    db.collection('shippingProviders').where('status', '==', 'active').get(),
    db.collection('storeShippingProviders').where('storeId', '==', storeId).get(),
    db.collection('integrationCredentials').where('storeId', '==', storeId).where('integrationType', '==', 'shipping').get(),
    db.doc(`storeIntegrationSettings/${storeId}`).get(),
  ])
  const configs = Object.fromEntries(configsSnap.docs.map((doc) => [doc.data()?.providerId, { id: doc.id, ...doc.data() }]))
  const credentialByProvider = Object.fromEntries(credentialsSnap.docs.map((doc) => [doc.data()?.provider, {
    status: doc.data()?.status || 'NOT_CONFIGURED',
    maskedCredentials: doc.data()?.maskedCredentials || {},
    lastValidatedAt: doc.data()?.lastValidatedAt || null,
    lastValidationStatus: doc.data()?.lastValidationStatus || null,
  }]))
  return {
    providers: providersSnap.docs.map((doc) => ({ provider: safeShippingProvider(doc.id, doc.data()), config: configs[doc.id] ? { ...configs[doc.id], credential: credentialByProvider[doc.data()?.slug] || null } : null })),
    adapters: listShippingAdapters(),
    settings: settingsSnap.exists ? settingsSnap.data() : { automaticShipmentCreation: 'AFTER_CONFIRMATION' },
    runtime: {
      functionRegion: SHIPPING_FUNCTION_REGION,
      environment: process.env.FUNCTIONS_EMULATOR === 'true' ? 'emulator' : 'production',
      webhookUrls: Object.fromEntries(providersSnap.docs
        // A public webhook URL is useful only when the provider adapter can
        // parse and authenticate that provider's real webhook contract. Do
        // not advertise a generic endpoint for an adapter that has not
        // declared those capabilities yet.
        .filter((doc) => {
          if (doc.data()?.integrationType !== 'api') return false
          const adapter = getShippingAdapter(doc.data()?.slug, 'api')
          return !!adapter?.parseWebhook && !!adapter.verifyWebhookSignature
        })
        .map((doc) => [String(doc.data()?.slug || ''), publicWebhookUrl(String(doc.data()?.slug || ''))])),
      appCheckCompatible: true,
      appCheckEnforced: false,
    },
  }
})

export const saveIntegrationCredentials = onCall({ region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = String(request.data?.storeId || '').trim()
  const providerId = String(request.data?.providerId || '').trim()
  if (!storeId || !providerId) throw new HttpsError('invalid-argument', 'storeId و providerId مطلوبان')
  await assertStoreAccess(request, storeId, 'settings:edit')
  const [storeSnap, providerSnap] = await Promise.all([db.doc(`stores/${storeId}`).get(), db.doc(`shippingProviders/${providerId}`).get()])
  if (!storeSnap.exists) throw new HttpsError('not-found', 'المتجر غير موجود')
  if (!providerSnap.exists || providerSnap.data()?.integrationType !== 'api') throw new HttpsError('failed-precondition', 'مزود API غير صالح')
  const provider = String(providerSnap.data()?.slug || '').trim().toLowerCase()
  if (provider === 'bosta' && providerSnap.data()?.credentialMode !== 'merchant') {
    throw new HttpsError('failed-precondition', 'Bosta requires merchant-owned credentials')
  }
  let credentials: Record<string, string>
  try { credentials = sanitizeCredentials(provider, request.data?.credentials) }
  catch (error) { throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'بيانات الاعتماد غير صالحة') }
  const ref = db.doc(`integrationCredentials/${credentialDocumentId(storeId, 'shipping', provider)}`)
  const existing = await ref.get()
  const keyVersion = Math.max(1, Number(existing.data()?.keyVersion || 0) + 1)
  const envelope = encryptCredentials(credentials, { storeId, provider, integrationType: 'shipping', keyVersion })
  const maskedCredentials = credentialSummary(credentials)
  await ref.set({
    id: ref.id,
    storeId,
    merchantId: storeSnap.data()?.ownerId || request.auth.uid,
    provider,
    providerId,
    integrationType: 'shipping',
    envelope,
    keyVersion,
    maskedCredentials,
    status: 'CONFIGURED',
    createdAt: existing.exists ? existing.data()?.createdAt : now(),
    updatedAt: now(),
    createdBy: existing.exists ? existing.data()?.createdBy : request.auth.uid,
    updatedBy: request.auth.uid,
    lastValidatedAt: null,
    lastValidationStatus: null,
  }, { merge: true })
  await db.doc(`storeShippingProviders/${storeId}_${providerId}`).set({ configurationStatus: 'CONFIGURED', updatedAt: now() }, { merge: true })
  return { ok: true, status: 'CONFIGURED', maskedCredentials, keyVersion }
})

export const saveShippingAutomationSettings = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = String(request.data?.storeId || '').trim()
  const automaticShipmentCreation = String(request.data?.automaticShipmentCreation || '')
  if (!storeId || !['MANUAL', 'AFTER_CONFIRMATION', 'IMMEDIATELY_AFTER_CHECKOUT'].includes(automaticShipmentCreation)) {
    throw new HttpsError('invalid-argument', 'إعداد الإنشاء التلقائي غير صالح')
  }
  await assertStoreAccess(request, storeId, 'settings:edit')
  const ref = db.doc(`storeIntegrationSettings/${storeId}`)
  const existing = await ref.get()
  await ref.set({ id: storeId, storeId, automaticShipmentCreation, createdAt: existing.exists ? existing.data()?.createdAt : now(), updatedAt: now(), updatedBy: request.auth.uid }, { merge: true })
  return { ok: true, automaticShipmentCreation }
})

export const saveStoreShippingProvider = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const raw = request.data || {}
  const storeId = String(raw.storeId || '').trim()
  const providerId = String(raw.providerId || '').trim()
  if (!storeId || !providerId) throw new HttpsError('invalid-argument', 'storeId و providerId مطلوبان')
  await assertStoreAccess(request, storeId, 'settings:edit')
  const actorId = request.auth.uid
  if (raw.credentials || raw.apiKey || raw.secret || raw.webhookSecret || raw.token) throw new HttpsError('invalid-argument', 'الأسرار لا تُخزن في إعدادات المتجر العامة')
  const providerSnap = await db.doc(`shippingProviders/${providerId}`).get()
  if (!providerSnap.exists || providerSnap.data()?.status !== 'active') throw new HttpsError('failed-precondition', 'شركة الشحن غير متاحة حالياً')
  const providerSlug = String(providerSnap.data()?.slug || '')
  const credentialSnap = providerSnap.data()?.integrationType === 'api'
    ? await db.doc(`integrationCredentials/${credentialDocumentId(storeId, 'shipping', providerSlug)}`).get()
    : null
  const input = raw.config || {}
  const providerServices = Array.isArray(providerSnap.data()?.services) ? providerSnap.data()!.services.map((service: any) => String(service?.code || '')) : []
  const enabledServiceCodes = Array.isArray(input.enabledServiceCodes) ? input.enabledServiceCodes.map(String).slice(0, 50) : []
  if (enabledServiceCodes.some((code: string) => providerServices.length > 0 && !providerServices.includes(code))) {
    throw new HttpsError('invalid-argument', 'الخدمة المختارة غير متاحة لدى شركة الشحن')
  }
  const waslaIdMap = (value: unknown, label: string) => {
    const rawMap = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const entries = Object.entries(rawMap).slice(0, 200)
    const result: Record<string, number> = {}
    for (const [name, id] of entries) {
      const numericId = Number(id)
      if (!String(name).trim() || !Number.isInteger(numericId) || numericId <= 0) throw new HttpsError('invalid-argument', `معرف ${label} غير صالح`)
      result[String(name).trim().slice(0, 120)] = numericId
    }
    return result
  }
  const config = {
    storeId,
    providerId,
    enabled: input.enabled !== false,
    displayName: String(input.displayName || '').slice(0, 120),
    serviceCode: String(input.serviceCode || '').slice(0, 80),
    pickupAddressId: input.pickupAddressId ? String(input.pickupAddressId).slice(0, 120) : null,
    codEnabled: input.codEnabled !== false,
    returnEnabled: input.returnEnabled === true,
    defaultPackageWeight: Math.max(0, Number(input.defaultPackageWeight || 0)),
    rateMode: ['api', 'fixed', 'zone', 'weight', 'hybrid'].includes(input.rateMode) ? input.rateMode : 'api',
    fixedRate: providerSnap.data()?.allowMerchantRateOverride === true ? Math.max(0, Number(input.fixedRate || 0)) : 0,
    freeShippingThreshold: Math.max(0, Number(input.freeShippingThreshold || 0)),
    enabledServiceCodes,
    rateMarkup: Math.max(0, Number(input.rateMarkup || 0)),
    etaMinHours: Math.max(0, Number(input.etaMinHours || 0)),
    etaMaxHours: Math.max(0, Number(input.etaMaxHours || 0)),
    allowRateOverride: input.allowRateOverride === true,
    waslaPickupLocationType: String(input.waslaPickupLocationType || 'merchant_store').slice(0, 60),
    waslaPickupLocationName: String(input.waslaPickupLocationName || '').slice(0, 160),
    waslaPickupContactPhone: String(input.waslaPickupContactPhone || '').slice(0, 40),
    waslaPickupAddressLine1: String(input.waslaPickupAddressLine1 || '').slice(0, 500),
    waslaPickupGovernorateId: Math.max(0, Math.floor(Number(input.waslaPickupGovernorateId || 0))),
    waslaPickupCityId: Math.max(0, Math.floor(Number(input.waslaPickupCityId || 0))),
    waslaGovernorateIds: waslaIdMap(input.waslaGovernorateIds, 'محافظة وصلة'),
    waslaCityIds: waslaIdMap(input.waslaCityIds, 'مدينة وصلة'),
    isDefault: input.isDefault === true,
    configurationStatus: input.enabled === false
      ? 'DISABLED'
      : !getShippingAdapter(providerSlug, providerSnap.data()?.integrationType)
        ? 'NOT_CONFIGURED'
        : providerSnap.data()?.integrationType === 'manual'
          ? 'CONNECTED'
          : credentialSnap?.exists
            ? String(credentialSnap.data()?.status || 'CONFIGURED')
            : 'NOT_CONFIGURED',
    updatedAt: now(),
  }
  const ref = db.doc(`storeShippingProviders/${storeId}_${providerId}`)
  const existing = await ref.get()
  await db.runTransaction(async (tx) => {
    if (config.isDefault) {
      const currentDefaults = await tx.get(db.collection('storeShippingProviders').where('storeId', '==', storeId).where('isDefault', '==', true))
      for (const doc of currentDefaults.docs) if (doc.id !== ref.id) tx.update(doc.ref, { isDefault: false, updatedAt: now() })
      tx.set(db.doc(`storeShippingDefaults/${storeId}`), { storeId, providerId, configId: ref.id, updatedAt: now() }, { merge: true })
    }
    tx.set(ref, { ...config, id: ref.id, createdAt: existing.exists ? existing.data()?.createdAt : now(), createdBy: existing.exists ? existing.data()?.createdBy : actorId }, { merge: true })
  })
  return { config: { id: ref.id, ...config, maskedAccountIdentifier: null, lastVerifiedAt: null } }
})

export const testShippingConnection = onCall({ region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const providerId = String(request.data?.providerId || '').trim()
  const storeId = request.data?.storeId ? String(request.data.storeId).trim() : ''
  const providerSnap = await db.doc(`shippingProviders/${providerId}`).get()
  if (!providerSnap.exists) throw new HttpsError('not-found', 'شركة الشحن غير موجودة')
  const provider = providerSnap.data() || {}
  const role = await getUserRole(request.auth.uid)
  if (role === 'superAdmin') {
    // Platform credentials are loaded only from server-side secret storage when
    // an adapter is configured. No raw secret is accepted from the client.
  } else {
    if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')
    await assertStoreAccess(request, storeId, 'settings:edit')
    const configSnap = await db.doc(`storeShippingProviders/${storeId}_${providerId}`).get()
    if (!configSnap.exists) throw new HttpsError('failed-precondition', 'فعّل شركة الشحن وأكمل إعدادها أولاً')
  }
  const adapter = getShippingAdapter(provider.slug, provider.integrationType)
  if (!adapter) return { ok: false, configured: false, message: 'API integration not configured' }
  const config = storeId ? (await db.doc(`storeShippingProviders/${storeId}_${providerId}`).get()).data() : null
  const vault = storeId && provider.integrationType !== 'manual'
    ? await loadIntegrationCredentials(db, storeId, 'shipping', String(provider.slug || ''))
    : null
  if (provider.integrationType !== 'manual' && !vault) return { ok: false, configured: false, status: 'NOT_CONFIGURED', message: 'بيانات الاعتماد غير محفوظة' }
  try {
    const result = await adapter.testConnection({ provider, config, credentials: vault?.credentials || null })
    const returnedStatus = String((result as any)?.status || '')
    const status = result.ok
      ? 'CONNECTED'
      : ['INVALID_CREDENTIALS', 'PROVIDER_UNAVAILABLE', 'ERROR'].includes(returnedStatus)
        ? returnedStatus
        : 'ERROR'
    const writes: Promise<unknown>[] = [providerSnap.ref.update({ lastTestedAt: now(), updatedAt: now() })]
    if (vault) writes.push(vault.ref.update({ status, lastValidatedAt: now(), lastValidationStatus: status, updatedAt: now() }))
    if (storeId) writes.push(db.doc(`storeShippingProviders/${storeId}_${providerId}`).set({ configurationStatus: status, lastVerifiedAt: now(), updatedAt: now() }, { merge: true }))
    await Promise.all(writes)
    return { ok: result.ok, configured: true, status, message: result.message, account: result.account || null }
  } catch (error) {
    const code = error instanceof ShippingProviderError ? error.code : 'PROVIDER_UNAVAILABLE'
    // Persist the same truthful state returned to the client. An invalid key
    // must not be collapsed into a vague ERROR, and a transient outage must
    // remain distinguishable from a merchant configuration issue.
    const status = code === 'INVALID_CREDENTIALS'
      ? 'INVALID_CREDENTIALS'
      : code === 'PROVIDER_UNAVAILABLE'
        ? 'PROVIDER_UNAVAILABLE'
        : 'ERROR'
    const message = sanitizeSensitiveText(error instanceof Error ? error.message : 'تعذر الاتصال بمزود الشحن')
    const writes: Promise<unknown>[] = []
    if (vault) writes.push(vault.ref.update({ status, lastValidatedAt: now(), lastValidationStatus: status, updatedAt: now() }))
    if (storeId) writes.push(db.doc(`storeShippingProviders/${storeId}_${providerId}`).set({ configurationStatus: status, lastVerifiedAt: now(), lastValidationStatus: status, updatedAt: now() }, { merge: true }))
    await Promise.all(writes)
    return { ok: false, configured: true, status, message }
  }
})

/** Public-safe checkout quote. It never returns provider credentials or raw documents. */
export const getShippingOptions = onCall({ region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey] }, async (request: CallableRequest<any>) => {
  const storeId = String(request.data?.storeId || '').trim()
  const destination = request.data?.destination || {}
  const subtotal = Math.max(0, Number(request.data?.subtotal || 0))
  if (!storeId || !String(destination.governorate || '').trim()) throw new HttpsError('invalid-argument', 'بيانات الوجهة غير مكتملة')
  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || storeSnap.data()?.active === false || storeSnap.data()?.published === false) throw new HttpsError('not-found', 'المتجر غير متاح')
  // Some early merchant configuration documents were written before the
  // `enabled` field was normalized to a boolean.  The merchant dashboard
  // correctly treats the legacy string value as enabled, while the old
  // Firestore equality query silently skipped it at checkout.  Read the
  // store's configurations once and normalize the flag in-process so both
  // screens make the exact same decision.
  const configsSnap = await db.collection('storeShippingProviders').where('storeId', '==', storeId).get()
  const enabledConfigDocs = configsSnap.docs.filter((doc) => {
    const enabled = doc.data()?.enabled
    return enabled === true || String(enabled || '').trim().toLowerCase() === 'true'
  })
  // Read the provider referenced by each merchant configuration directly.
  // This avoids a stale broad-list query making an otherwise enabled merchant
  // configuration disappear from checkout while an administrator is editing providers.
  const providerDocs = await Promise.all(enabledConfigDocs.map((configDoc) => db.doc(`shippingProviders/${String(configDoc.data()?.providerId || '')}`).get()))
  const providerById = new Map<string, Record<string, any>>(
    providerDocs
      .filter((doc) => doc.exists && doc.data()?.status === 'active')
      .map((doc) => [doc.id, { id: doc.id, ...doc.data() }]),
  )
  const reconciledProviderByConfigId = new Map<string, Record<string, any>>()
  // Older stores can still have a configuration that points at the retired
  // `shippingCompanies` collection.  Resolve that reference only when its
  // stored slug/name unambiguously matches one active canonical provider,
  // then create the canonical configuration before returning a quote.  This
  // is deliberately not a "first active provider" fallback: checkout must
  // never charge a customer through an unrelated carrier.
  const alias = (value: unknown) => String(value || '')
    .trim()
    .toLocaleLowerCase('ar-EG')
    .replace(/[\s_\-]+/g, '')
  const unresolvedConfigs = enabledConfigDocs.filter((doc) => !providerById.has(String(doc.data()?.providerId || '')))
  if (unresolvedConfigs.length) {
    const activeProvidersSnap = await db.collection('shippingProviders').where('status', '==', 'active').get()
    const activeProviders = activeProvidersSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })) as Array<Record<string, any>>
    await Promise.all(unresolvedConfigs.map(async (configDoc) => {
      const legacyProviderId = String(configDoc.data()?.providerId || '').trim()
      if (!legacyProviderId) return
      const legacySnap = await db.doc(`shippingCompanies/${legacyProviderId}`).get().catch(() => null)
      const legacy = legacySnap?.exists ? legacySnap.data() || {} : {}
      const hints = new Set([
        configDoc.data()?.providerSlug,
        configDoc.data()?.slug,
        configDoc.data()?.providerKey,
        configDoc.data()?.providerName,
        configDoc.data()?.shippingCompanyName,
        legacy.slug,
        legacy.providerSlug,
        legacy.name,
      ].map(alias).filter(Boolean))
      const matches = activeProviders.filter((candidate) => {
        const candidateAliases = [candidate.slug, candidate.name].map(alias)
        return candidateAliases.some((candidateAlias) => hints.has(candidateAlias))
      })
      if (matches.length !== 1) return
      const provider = matches[0]
      const canonicalRef = db.doc(`storeShippingProviders/${storeId}_${provider.id}`)
      const currentCanonical = await canonicalRef.get()
      if (!currentCanonical.exists) {
        const legacyConfig = configDoc.data() || {}
        await canonicalRef.set({
          ...legacyConfig,
          id: canonicalRef.id,
          storeId,
          providerId: provider.id,
          providerSlug: String(provider.slug || ''),
          migratedFromProviderId: legacyProviderId,
          migratedAt: now(),
          updatedAt: now(),
        }, { merge: true })
      }
      // Keep the legacy document for audit/history, but remove it from future
      // checkout queries now that the canonical configuration is in place.
      await configDoc.ref.set({
        enabled: false,
        configurationStatus: 'MIGRATED',
        migratedToProviderId: provider.id,
        migratedAt: now(),
        updatedAt: now(),
      }, { merge: true })
      providerById.set(provider.id, provider)
      reconciledProviderByConfigId.set(configDoc.id, provider)
    }))
  }
  const options: Array<Record<string, unknown>> = []
  const unavailableReasons: string[] = []
  let hasCanonicalProvider = false
  if (!enabledConfigDocs.length) unavailableReasons.push('لم يُفعّل التاجر أي شركة شحن لهذا المتجر بعد')
  for (const configDoc of enabledConfigDocs) {
    const config = configDoc.data() || {}
    let provider = providerById.get(String(config.providerId))
    // A legacy configuration may have been reconciled above. Resolve the
    // canonical record from its uniquely matched slug/name and use the new
    // provider ID for this quote immediately (the configuration was persisted
    // before this loop so createOrder sees the same choice).
    if (!provider) {
      const migrated = reconciledProviderByConfigId.get(configDoc.id) || Array.from(providerById.values()).find((candidate) => {
        const candidateAliases = [candidate.slug, candidate.name].map(alias)
        const configAliases = [config.providerSlug, config.slug, config.providerKey, config.providerName, config.shippingCompanyName].map(alias)
        return candidateAliases.some((candidateAlias) => configAliases.includes(candidateAlias))
      })
      provider = migrated
    }
    if (!provider) {
      unavailableReasons.push('شركة شحن مفعّلة لدى التاجر لم تعد متاحة من المنصة')
      continue
    }
    hasCanonicalProvider = true
    const adapter = getShippingRateAdapter(provider.slug, provider.integrationType)
    if (!adapter.getRates) {
      unavailableReasons.push(`شركة ${String(provider.name || 'الشحن')} لا تدعم التسعير حالياً`)
      continue
    }
    let rates: Array<Record<string, any>> = []
    try {
      const providerSlug = String(provider.slug || '').toLowerCase()
      const vault = providerSlug === 'wasla'
        ? await loadIntegrationCredentials(db, storeId, 'shipping', providerSlug).catch(() => null)
        : null
      if (providerSlug === 'wasla' && !vault) {
        unavailableReasons.push('أكمل التاجر حفظ واختبار مفتاح وصلة أولاً')
        continue
      }
      rates = await adapter.getRates({ provider, config, credentials: vault?.credentials || null }, {
        subtotal,
        currency: storeSnap.data()?.currency || 'EGP',
        governorate: destination.governorate,
        city: destination.city || '',
        area: destination.area || '',
        weightKg: Math.max(0, Number(request.data?.packageWeightKg || 0)),
      }) as Array<Record<string, any>>
    } catch (error) {
      const detail = sanitizeSensitiveText(error instanceof Error ? error.message : '')
      unavailableReasons.push(detail
        ? `تعذر تسعير شركة ${String(provider.name || 'الشحن')}: ${detail}`
        : `تعذر الحصول على سعر شركة ${String(provider.name || 'الشحن')} الآن`)
      continue
    }
    if (!rates.length) unavailableReasons.push(`شركة ${String(provider.name || 'الشحن')} لا تغطي هذه الوجهة بالخدمة المختارة`)
    const enabledCodes = Array.isArray(config.enabledServiceCodes) ? config.enabledServiceCodes.map(String) : []
    options.push(...rates
      .filter((rate) => !enabledCodes.length || enabledCodes.includes(String(rate.serviceCode || '')))
      .map((rate) => ({
        providerId: provider.id,
        providerName: provider.name,
        serviceCode: String(rate.serviceCode || ''),
        serviceName: String(rate.serviceName || rate.name || provider.name),
        price: Number(rate.price ?? rate.amount ?? 0),
        amount: Number(rate.price ?? rate.amount ?? 0),
        currency: String(rate.currency || storeSnap.data()?.currency || 'EGP'),
        etaMin: rate.etaMin ?? null,
        etaMax: rate.etaMax ?? null,
        etaUnit: rate.etaUnit || 'hours',
        codAvailable: rate.codAvailable === true,
        trackingAvailable: rate.trackingAvailable === true,
        zoneId: rate.zoneId || null,
        zoneName: rate.zoneName || null,
        codFee: Number(rate.codFee || 0),
        returnFee: Number(rate.returnFee || 0),
        weightKg: Number(rate.weightKg || 0),
      })))
  }
  // Legacy zones are only a migration fallback for stores that have no
  // active canonical provider. A configured provider with no coverage must
  // stay unavailable; it must never silently fall back to a conflicting rate.
  if (!options.length && !hasCanonicalProvider) {
    const zonesSnap = await db.collection('shipping').where('storeId', '==', storeId).where('active', '==', true).get()
    const fallback = computeShippingFee(storeSnap.data()?.shipping, zonesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })), subtotal, String(destination.governorate))
    if (fallback.available) options.push({ providerId: fallback.snapshot?.providerId || null, providerName: fallback.method, serviceCode: 'legacy', serviceName: fallback.method, price: fallback.fee, amount: fallback.fee, currency: storeSnap.data()?.currency || 'EGP', estimatedDays: null, etaMin: null, etaMax: null, etaUnit: 'hours', codAvailable: true, trackingAvailable: false, legacy: true })
  }
  const actionableReason = unavailableReasons.find((reason) => !reason.includes('لم تعد متاحة من المنصة'))
  return { options, unavailableReason: options.length ? null : actionableReason || unavailableReasons[0] || 'لا توجد خدمة شحن مفعّلة لهذه الوجهة' }
})

/** Merchant-only lookup: returns Wasla's live location names/IDs, never its API key. */
export const getWaslaLocations = onCall({ region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = String(request.data?.storeId || '').trim()
  const providerId = String(request.data?.providerId || '').trim()
  if (!storeId || !providerId) throw new HttpsError('invalid-argument', 'storeId و providerId مطلوبان')
  await assertStoreAccess(request, storeId, 'settings:edit')
  const providerSnap = await db.doc(`shippingProviders/${providerId}`).get()
  if (!providerSnap.exists || String(providerSnap.data()?.slug || '').toLowerCase() !== 'wasla') throw new HttpsError('failed-precondition', 'مزود وصلة غير صالح')
  const vault = await loadIntegrationCredentials(db, storeId, 'shipping', 'wasla').catch(() => null)
  if (!vault) throw new HttpsError('failed-precondition', 'احفظ مفتاح وصلة أولاً')
  const adapter = getShippingAdapter('wasla', 'api')
  if (!adapter?.getLocations) throw new HttpsError('failed-precondition', 'محول وصلة غير متاح')
  try {
    return { locations: await adapter.getLocations({ provider: providerSnap.data() || {}, credentials: vault.credentials || null }) }
  } catch (error) {
    throw new HttpsError('unavailable', sanitizeSensitiveText(error instanceof Error ? error.message : 'تعذر تحميل مناطق وصلة'))
  }
})

/** Creates a shipment through the selected store-enabled provider. */
export const createOrderShipment = onCall({ region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const orderId = String(request.data?.orderId || '').trim()
  const providerId = request.data?.providerId ? String(request.data.providerId).trim() : null
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId مطلوب')
  const orderSnap = await db.doc(`orders/${orderId}`).get()
  if (!orderSnap.exists) throw new HttpsError('not-found', 'الطلب غير موجود')
  const order = orderSnap.data() || {}
  await assertStoreAccess(request, String(order.storeId || ''), ['orders:view', 'orders:edit'])
  try {
    const result = await createShipmentForOrder(db, { orderId, providerId, trigger: request.data?.retry === true ? 'RETRY' : 'MANUAL', actorId: request.auth.uid })
    return { ok: true, ...result }
  } catch (error) {
    if (error instanceof ShippingProviderError) throw new HttpsError(error.retryable ? 'unavailable' : 'failed-precondition', error.message, { code: error.code, retryable: error.retryable })
    throw new HttpsError('internal', error instanceof Error ? error.message : 'تعذر إنشاء الشحنة')
  }
})

/** Starts a merchant-managed customer return. Carrier pickup is connected only
 * when that carrier's adapter explicitly supports return collection. */
export const requestOrderReturn = onCall(async (request: CallableRequest<{ orderId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const orderId = String(request.data?.orderId || '').trim()
  if (!orderId) throw new HttpsError('invalid-argument', 'معرف الطلب مطلوب')
  const orderRef = db.doc(`orders/${orderId}`)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) throw new HttpsError('not-found', 'الطلب غير موجود')
  const order = orderSnap.data() || {}
  await assertStoreAccess(request, String(order.storeId || ''), ['orders:edit', 'orders:status'])
  if (String(order.status) !== 'DELIVERED') throw new HttpsError('failed-precondition', 'يمكن طلب المرتجع للطلبات المسلمة فقط')
  const returnRef = db.doc(`orderReturns/${orderId}`)
  const result = await db.runTransaction(async (tx) => {
    const existing = await tx.get(returnRef)
    if (existing.exists && ['REQUESTED', 'RECEIVED'].includes(String(existing.data()?.status))) return { changed: false, status: existing.data()?.status }
    tx.set(returnRef, {
      id: orderId,
      orderId,
      storeId: order.storeId,
      status: 'REQUESTED',
      requestedAt: now(),
      requestedBy: request.auth!.uid,
      createdAt: existing.exists ? existing.data()?.createdAt || now() : now(),
      updatedAt: now(),
    }, { merge: true })
    tx.set(orderRef, { returnStatus: 'REQUESTED', returnRequestedAt: now(), updatedAt: now() }, { merge: true })
    return { changed: true, status: 'REQUESTED' }
  })
  return { ok: true, ...result }
})

/** Marks the physical return as received. The caller then transitions the
 * order to RETURNED through the existing guarded stock-restoration workflow. */
export const receiveOrderReturn = onCall(async (request: CallableRequest<{ orderId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const orderId = String(request.data?.orderId || '').trim()
  if (!orderId) throw new HttpsError('invalid-argument', 'معرف الطلب مطلوب')
  const orderRef = db.doc(`orders/${orderId}`)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) throw new HttpsError('not-found', 'الطلب غير موجود')
  const order = orderSnap.data() || {}
  await assertStoreAccess(request, String(order.storeId || ''), ['orders:edit', 'orders:status'])
  if (String(order.status) !== 'DELIVERED') throw new HttpsError('failed-precondition', 'لا يمكن استلام مرتجع لهذا الطلب الآن')
  const returnRef = db.doc(`orderReturns/${orderId}`)
  await db.runTransaction(async (tx) => {
    const current = await tx.get(returnRef)
    if (!current.exists || !['REQUESTED', 'RECEIVED'].includes(String(current.data()?.status))) throw new HttpsError('failed-precondition', 'اطلب المرتجع أولاً قبل تأكيد استلامه')
    if (String(current.data()?.status) === 'RECEIVED') return
    tx.update(returnRef, { status: 'RECEIVED', receivedAt: now(), receivedBy: request.auth!.uid, updatedAt: now() })
    tx.set(orderRef, { returnStatus: 'RECEIVED', returnReceivedAt: now(), updatedAt: now() }, { merge: true })
  })
  return { ok: true, status: 'RECEIVED' }
})

export const refreshShipmentTracking = onCall({ region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const shipmentId = String(request.data?.shipmentId || '').trim()
  const shipmentRef = db.doc(`shipments/${shipmentId}`)
  const shipmentSnap = await shipmentRef.get()
  if (!shipmentSnap.exists) throw new HttpsError('not-found', 'الشحنة غير موجودة')
  const shipment = shipmentSnap.data() || {}
  await assertStoreAccess(request, String(shipment.storeId || ''), 'orders:view')
  const linkedOrderSnap = await db.doc(`orders/${String(shipment.orderId || '')}`).get()
  const [providerSnap, configSnap] = await Promise.all([db.doc(`shippingProviders/${shipment.providerId}`).get(), db.doc(`storeShippingProviders/${shipment.storeId}_${shipment.providerId}`).get()])
  if (!providerSnap.exists) throw new HttpsError('failed-precondition', 'مزود الشحن غير موجود')
  const provider = { id: providerSnap.id, ...(providerSnap.data() || {}) } as Record<string, any>
  const adapter = getShippingAdapter(provider.slug, provider.integrationType)
  if (!adapter?.trackShipment) throw new HttpsError('failed-precondition', 'التتبع غير مدعوم لهذا المزود')
  const vault = await loadIntegrationCredentials(db, shipment.storeId, 'shipping', provider.slug)
  if (!vault) throw new HttpsError('failed-precondition', 'بيانات الاعتماد غير مهيأة')
  const result = await adapter.trackShipment({ provider, config: configSnap.data() || {}, credentials: vault.credentials }, shipment)
  const status = adapter.mapStatus ? adapter.mapStatus(String(result.status || shipment.status)) : shipment.status
  // API-carrier state is authoritative. Apply it through the same guarded
  // transition used by webhooks so the linked order, inventory and analytics
  // can never drift away from the shipment after a manual refresh.
  await applySystemShipmentStatus(shipmentId, String(status), `poll:${String(provider.slug || 'carrier')}`)
  const waslaFallbackCode = String(provider.slug || '') === 'wasla'
    ? waslaPublicTrackingCode(result.providerShipmentId || shipment.providerShipmentId)
    : null
  const trackingNumber = result.trackingNumber || waslaFallbackCode || shipment.trackingNumber || shipment.providerShipmentId || null
  // A carrier can disclose the delivery-attempt reason in an earlier response
  // but omit it in a later status poll. Never replace a real recorded reason
  // with the generic fallback in that case.
  const carrierFailureReason = result.failureReason
    ? String(result.failureReason).trim().slice(0, 500)
    : ''
  const recordedFailureReason = String(shipment.failureReason || '').trim()
  const failureReason = carrierFailureReason
    || (String(status).toUpperCase() === 'FAILED' && recordedFailureReason ? recordedFailureReason : null)
    || (String(status).toUpperCase() === 'FAILED'
      ? 'سجّلت شركة الشحن تعذّر التسليم، لكنها لم تُرسل سبب المحاولة عبر API. راجع تفاصيل الشحنة في لوحة شركة الشحن.'
      : null)
  await shipmentRef.set({
    trackingNumber,
    providerShipmentId: result.providerShipmentId || shipment.providerShipmentId || null,
    ...(typeof result.shippingCost === 'number' ? { shippingCost: result.shippingCost, carrierShippingCost: result.shippingCost } : {}),
    failureReason,
    lastSyncedAt: now(), updatedAt: now(),
  }, { merge: true })
  return { ok: true, status, trackingNumber, failureReason }
})

/**
 * Records a confirmed COD remittance from a carrier.  The Wasla merchant API
 * exposes shipments and their COD amounts, but not a wallet/settlement feed;
 * therefore this never claims to initiate or verify a bank transfer.  It
 * creates an immutable, server-calculated ledger entry from delivered COD
 * shipments that have not been settled before.
 */
export const recordShippingSettlement = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = String(request.data?.storeId || '').trim()
  const providerId = String(request.data?.providerId || '').trim()
  const reference = String(request.data?.reference || '').trim().slice(0, 250)
  const note = String(request.data?.note || '').trim().slice(0, 1000)
  if (!storeId || !providerId) throw new HttpsError('invalid-argument', 'المتجر وشركة الشحن مطلوبان')
  await assertStoreAccess(request, storeId, 'billing:edit')

  // Query by store first so this works without a composite customer index;
  // selection is capped below Firestore's atomic transaction write limit.
  const storeShipments = await db.collection('shipments').where('storeId', '==', storeId).get()
  const candidates = storeShipments.docs.filter((doc) => {
    const shipment = doc.data() || {}
    return String(shipment.providerId || shipment.shippingCompanyId || '') === providerId
      && String(shipment.status || shipment.currentStatus || '').toUpperCase() === 'DELIVERED'
      && Number(shipment.codAmount || 0) > 0
      && !shipment.settlementId
  }).slice(0, 400)

  if (!candidates.length) throw new HttpsError('failed-precondition', 'لا توجد شحنات دفع عند الاستلام مسلّمة وغير مسوّاة لهذه الشركة')

  const providerSnap = await db.doc(`shippingProviders/${providerId}`).get()
  const providerName = String(providerSnap.data()?.name || candidates[0].data()?.providerName || candidates[0].data()?.shippingCompanyName || 'شركة الشحن')
  const settlementRef = db.collection('shippingSettlements').doc()
  const result = await db.runTransaction(async (tx) => {
    const current = await Promise.all(candidates.map((candidate) => tx.get(candidate.ref)))
    const eligible = current.filter((snap) => {
      const shipment = snap.data() || {}
      return snap.exists
        && String(shipment.providerId || shipment.shippingCompanyId || '') === providerId
        && String(shipment.status || shipment.currentStatus || '').toUpperCase() === 'DELIVERED'
        && Number(shipment.codAmount || 0) > 0
        && !shipment.settlementId
    })
    if (!eligible.length) throw new HttpsError('aborted', 'تمت تسوية هذه الشحنات بالفعل، حدّث الصفحة وحاول مرة أخرى')

    const grossCodCollected = eligible.reduce((sum, snap) => sum + Math.max(0, Number(snap.data()?.codAmount || 0)), 0)
    const carrierFees = eligible.reduce((sum, snap) => {
      const shipment = snap.data() || {}
      const fee = shipment.carrierShippingCost ?? shipment.shippingCost ?? shipment.priceSnapshot?.deliveryPrice ?? 0
      return sum + Math.max(0, Number(fee || 0))
    }, 0)
    const settledAt = now()
    const netMerchantDue = Math.max(0, grossCodCollected - carrierFees)
    const shipmentIds = eligible.map((snap) => snap.id)
    for (const snap of eligible) {
      tx.set(snap.ref, {
        settlementId: settlementRef.id,
        settledAt,
        settlementReference: reference || null,
        updatedAt: now(),
      }, { merge: true })
    }
    tx.set(settlementRef, {
      id: settlementRef.id,
      storeId,
      providerId,
      providerName,
      shipmentIds,
      shipmentCount: shipmentIds.length,
      grossCodCollected,
      carrierFees,
      netMerchantDue,
      reference: reference || null,
      note: note || null,
      settledAt,
      createdBy: request.auth!.uid,
      createdAt: now(),
      updatedAt: now(),
    })
    return { shipmentCount: shipmentIds.length, grossCodCollected, carrierFees, netMerchantDue }
  })
  return { ok: true, settlementId: settlementRef.id, ...result, hasMore: candidates.length === 400 }
})

export const downloadShipmentDocument = onCall({ region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const shipmentId = String(request.data?.shipmentId || '').trim()
  const shipmentSnap = await db.doc(`shipments/${shipmentId}`).get()
  if (!shipmentSnap.exists) throw new HttpsError('not-found', 'الشحنة غير موجودة')
  const shipment = shipmentSnap.data() || {}
  await assertStoreAccess(request, String(shipment.storeId || ''), 'orders:view')
  const [providerSnap, configSnap] = await Promise.all([
    db.doc(`shippingProviders/${shipment.providerId}`).get(),
    db.doc(`storeShippingProviders/${shipment.storeId}_${shipment.providerId}`).get(),
  ])
  if (!providerSnap.exists) throw new HttpsError('failed-precondition', 'مزود الشحن غير موجود')
  const provider = { id: providerSnap.id, ...(providerSnap.data() || {}) } as Record<string, any>
  const adapter = getShippingAdapter(provider.slug, provider.integrationType)
  if (!adapter?.getShipmentDocument) throw new HttpsError('failed-precondition', 'مستند الشحنة غير مدعوم لهذا المزود')
  const vault = await loadIntegrationCredentials(db, shipment.storeId, 'shipping', provider.slug)
  if (!vault) throw new HttpsError('failed-precondition', 'بيانات الاعتماد غير مهيأة')
  try {
    const document = await adapter.getShipmentDocument({ provider, config: configSnap.data() || {}, credentials: vault.credentials }, shipment)
    await shipmentSnap.ref.set({ documentAvailable: true, documentVerifiedAt: now(), updatedAt: now() }, { merge: true })
    return { ok: true, ...document }
  } catch (error) {
    const code = error instanceof ShippingProviderError ? error.code : 'PROVIDER_UNAVAILABLE'
    const message = sanitizeSensitiveText(error instanceof Error ? error.message : 'تعذر تحميل مستند الشحنة')
    throw new HttpsError(error instanceof ShippingProviderError && !error.retryable ? 'failed-precondition' : 'unavailable', message, { code })
  }
})

export const cancelExternalShipment = onCall({ region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey] }, async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const shipmentId = String(request.data?.shipmentId || '').trim()
  const shipmentRef = db.doc(`shipments/${shipmentId}`)
  const shipmentSnap = await shipmentRef.get()
  if (!shipmentSnap.exists) throw new HttpsError('not-found', 'الشحنة غير موجودة')
  const shipment = shipmentSnap.data() || {}
  await assertStoreAccess(request, String(shipment.storeId || ''), ['orders:edit', 'orders:cancel'])
  if (['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'].includes(String(shipment.status))) throw new HttpsError('failed-precondition', 'لا يمكن إلغاء الشحنة بعد استلامها')
  const [providerSnap, configSnap] = await Promise.all([db.doc(`shippingProviders/${shipment.providerId}`).get(), db.doc(`storeShippingProviders/${shipment.storeId}_${shipment.providerId}`).get()])
  const provider = { id: providerSnap.id, ...(providerSnap.data() || {}) } as Record<string, any>
  const adapter = getShippingAdapter(provider.slug, provider.integrationType)
  if (!adapter?.cancelShipment) throw new HttpsError('failed-precondition', 'الإلغاء غير مدعوم لهذا المزود')
  const vault = await loadIntegrationCredentials(db, shipment.storeId, 'shipping', provider.slug)
  if (!vault) throw new HttpsError('failed-precondition', 'بيانات الاعتماد غير مهيأة')
  await adapter.cancelShipment({ provider, config: configSnap.data() || {}, credentials: vault.credentials }, shipment)
  await applySystemShipmentStatus(shipmentId, 'CANCELLED', `api-cancel:${String(provider.slug || 'carrier')}`)
  await shipmentRef.set({ cancelledAt: now(), updatedAt: now() }, { merge: true })
  return { ok: true, status: 'CANCELLED' }
})

export const processIntegrationEvent = onDocumentCreated({ document: 'integrationEvents/{eventId}', region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey] }, async (event) => {
  const snap = event.data
  if (!snap) return
  const ref = snap.ref
  const claimed = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref)
    if (!fresh.exists || fresh.data()?.processingStatus !== 'PENDING') return false
    tx.update(ref, { processingStatus: 'PROCESSING', attempts: FieldValue.increment(1), lastAttemptAt: now() })
    return true
  })
  if (!claimed) return
  const data = snap.data() || {}
  try {
    let outcome = 'NO_CONSUMER'
    if (data.eventType === 'order.created' || data.eventType === 'order.confirmed') {
      const settingsSnap = await db.doc(`storeIntegrationSettings/${data.storeId}`).get()
      const mode = settingsSnap.data()?.automaticShipmentCreation || 'AFTER_CONFIRMATION'
      const shouldCreate = (mode === 'IMMEDIATELY_AFTER_CHECKOUT' && data.eventType === 'order.created')
        || (mode === 'AFTER_CONFIRMATION' && data.eventType === 'order.confirmed')
      if (shouldCreate) {
        await createShipmentForOrder(db, { orderId: data.entityId, providerId: null, trigger: mode, actorId: 'integration-event-consumer' })
        outcome = 'SHIPMENT_CREATED'
      } else outcome = mode === 'MANUAL' ? 'MANUAL_MODE' : 'TRIGGER_NOT_MATCHED'
    }
    const whatsappOutcome = await queueWhatsAppAutomationEvent(String(data.eventId || event.params.eventId), data)
    // Shipping and WhatsApp are independent consumers of the same event. Keep
    // their outcomes in separate fields so one channel can never change the
    // operational shipping result (or make retries ambiguous).
    await ref.update({ processingStatus: 'PROCESSED', outcome, whatsappOutcome, processedAt: now(), errorCode: null, errorMessage: null })
  } catch (error) {
    const code = error instanceof ShippingProviderError ? error.code : 'EVENT_PROCESSING_FAILED'
    const message = sanitizeSensitiveText(error instanceof Error ? error.message : 'Event processing failed')
    await ref.update({ processingStatus: 'FAILED', errorCode: code, errorMessage: message.slice(0, 500), processedAt: null })
  }
})

async function applySystemShipmentStatus(shipmentId: string, normalizedStatus: string, source: string) {
  const shipmentRef = db.doc(`shipments/${shipmentId}`)
  return db.runTransaction(async (tx) => {
    const shipmentSnap = await tx.get(shipmentRef)
    if (!shipmentSnap.exists) throw new Error('Shipment not found')
    const shipment = shipmentSnap.data() || {}
    const orderRef = db.doc(`orders/${shipment.orderId}`)
    const orderSnap = await tx.get(orderRef)
    if (!orderSnap.exists || orderSnap.data()?.storeId !== shipment.storeId) throw new Error('Shipment order is invalid')
    const order = orderSnap.data() || {}
    // The carrier is the single source of truth once a shipment exists.  In
    // particular, a newly-created label is still an order being prepared; it
    // must never leave a merchant-facing order marked as shipped.
    const nextOrderStatus = ['CREATED', 'READY_FOR_PICKUP'].includes(normalizedStatus) ? 'PROCESSING'
      : ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(normalizedStatus) ? 'SHIPPED'
        : normalizedStatus === 'DELIVERED' ? 'DELIVERED'
          : normalizedStatus === 'RETURNED' ? 'RETURNED' : null
    if (shipment.status === normalizedStatus) {
      // Keep the carrier state on the order even when it has no direct order
      // lifecycle equivalent (for example FAILED).  Merchant lists, details,
      // public tracking, and reports all read this mirror and must never keep
      // showing an older “shipped” state after the carrier has failed it.
      if (order.shipmentStatus !== normalizedStatus || (nextOrderStatus && order.status !== nextOrderStatus)) {
        tx.update(orderRef, {
          ...(nextOrderStatus ? { status: nextOrderStatus } : {}),
          shipmentStatus: normalizedStatus,
          statusHistory: FieldValue.arrayUnion({ status: nextOrderStatus || order.status || 'NEW', shipmentStatus: normalizedStatus, at: Timestamp.now(), by: 'shipping-sync', source }),
          updatedAt: now(),
        })
      }
      return { duplicate: true, storeId: shipment.storeId, orderId: shipment.orderId, nextOrderStatus }
    }
    const shouldRestore = normalizedStatus === 'RETURNED' && order.stockRestored !== true
    const products: Array<{ ref: DocumentReference; data: any }> = []
    if (shouldRestore) {
      for (const item of order.items || []) {
        const productRef = db.doc(`products/${item.productId}`)
        const productSnap = await tx.get(productRef)
        if (productSnap.exists && productSnap.data()?.storeId === shipment.storeId) products.push({ ref: productRef, data: productSnap.data() })
      }
    }
    if (shouldRestore) {
      for (const item of order.items || []) {
        const product = products.find((entry) => entry.ref.id === item.productId)
        if (!product) continue
        let variant: any = null
        if (Array.isArray(product.data.variants)) {
          variant = item.variantId ? product.data.variants.find((value: any) => value.id === item.variantId) : null
          if (!variant) variant = product.data.variants.find((value: any) => (value.color || '') === (item.color || '') && (value.size || '') === (item.size || '')) || null
        }
        if (variant) {
          variant.stock = Number(variant.stock || 0) + Number(item.quantity || 0)
          tx.update(product.ref, { variants: product.data.variants, stock: product.data.variants.reduce((sum: number, value: any) => sum + Number(value.stock || 0), 0), updatedAt: now() })
        } else if (!Array.isArray(product.data.variants) || product.data.variants.length === 0) {
          tx.update(product.ref, { stock: FieldValue.increment(Number(item.quantity || 0)), updatedAt: now() })
        }
      }
    }
    tx.update(shipmentRef, {
      status: normalizedStatus,
      currentStatus: normalizedStatus,
      active: !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(normalizedStatus),
      events: FieldValue.arrayUnion({ status: normalizedStatus, at: Timestamp.now(), source }),
      lastSyncedAt: now(),
      updatedAt: now(),
      ...(['DELIVERED', 'RETURNED'].includes(normalizedStatus) ? { completedAt: now() } : {}),
    })
    // Shipment status is always mirrored to the order. Some carrier statuses
    // (notably FAILED and CANCELLED) intentionally do not force an order
    // lifecycle transition, but they still have to be visible everywhere.
    tx.update(orderRef, {
      ...(nextOrderStatus ? { status: nextOrderStatus } : {}),
      shipmentStatus: normalizedStatus,
      statusHistory: FieldValue.arrayUnion({ status: nextOrderStatus || order.status || 'NEW', shipmentStatus: normalizedStatus, at: Timestamp.now(), by: 'shipping-webhook', source }),
      ...(shouldRestore ? { stockRestored: true } : {}),
      updatedAt: now(),
    })
    emitIntegrationEvent(db, tx, {
      storeId: shipment.storeId,
      eventType: normalizedStatus === 'DELIVERED' ? 'shipment.delivered' : normalizedStatus === 'RETURNED' ? 'shipment.returned' : 'shipment.status_changed',
      entityType: 'shipment',
      entityId: shipmentId,
      payload: { shipmentId, orderId: shipment.orderId, previousStatus: shipment.status, status: normalizedStatus, source },
    })
    return { duplicate: false, storeId: shipment.storeId, orderId: shipment.orderId, nextOrderStatus }
  })
}

export const shippingWebhook = onRequest({ region: SHIPPING_FUNCTION_REGION, secrets: [integrationVaultKey], cors: false }, async (request, response) => {
  if (request.method !== 'POST') { response.status(405).send('Method Not Allowed'); return }
  const providerSlug = String(request.path.split('/').filter(Boolean).pop() || request.query.provider || '').toLowerCase()
  const adapter = getShippingAdapter(providerSlug, 'api')
  if (!adapter?.parseWebhook || !adapter.verifyWebhookSignature) { response.status(404).send('Unknown provider'); return }
  let parsed: Record<string, any>
  try { parsed = adapter.parseWebhook(request.body, request.headers as Record<string, string | string[] | undefined>) as Record<string, any> }
  catch { response.status(400).send('Invalid payload'); return }
  let shipmentQuery = parsed.providerShipmentId
    ? await db.collection('shipments').where('provider', '==', providerSlug).where('externalShipmentId', '==', parsed.providerShipmentId).limit(2).get()
    : null
  if ((!shipmentQuery || shipmentQuery.empty) && parsed.trackingNumber) {
    shipmentQuery = await db.collection('shipments').where('provider', '==', providerSlug).where('trackingNumber', '==', parsed.trackingNumber).limit(2).get()
  }
  if (!shipmentQuery || shipmentQuery.size !== 1) { response.status(404).send('Shipment not found'); return }
  const shipmentDoc = shipmentQuery.docs[0]
  const shipment = shipmentDoc.data() || {}
  const vault = await loadIntegrationCredentials(db, shipment.storeId, 'shipping', providerSlug).catch(() => null)
  if (!vault || !adapter.verifyWebhookSignature(request.body, request.headers as Record<string, string | string[] | undefined>, vault.credentials)) {
    response.status(401).send('Invalid webhook authorization'); return
  }
  const webhookId = createHash('sha256').update(`${providerSlug}:${parsed.externalEventId}`).digest('hex')
  const logRef = db.doc(`integrationWebhookLogs/${webhookId}`)
  const existing = await logRef.get()
  if (existing.exists && existing.data()?.processingStatus === 'PROCESSED') { response.status(200).json({ ok: true, duplicate: true }); return }
  await logRef.set({
    id: webhookId, storeId: shipment.storeId, provider: providerSlug, integrationType: 'shipping', externalEventId: parsed.externalEventId,
    shipmentId: shipmentDoc.id, externalShipmentId: parsed.providerShipmentId || null, trackingNumber: parsed.trackingNumber || null,
    externalStatus: parsed.externalStatus, mappedStatus: parsed.status, processingStatus: 'PROCESSING', attempts: FieldValue.increment(1),
    receivedAt: existing.exists ? existing.data()?.receivedAt : now(), lastAttemptAt: now(), updatedAt: now(),
  }, { merge: true })
  try {
    const transition = await applySystemShipmentStatus(shipmentDoc.id, String(parsed.status), `webhook:${providerSlug}`)
    // Some carriers include the operational failure reason in the webhook
    // itself. Keep it with the shipment so the order screen, reports and
    // public tracking all show the same actionable explanation immediately,
    // without waiting for the next polling cycle.
    const webhookFailureReason = String(parsed.failureReason || parsed.failure_reason || parsed.reason || parsed.statusReason || '').trim()
    if (webhookFailureReason) {
      await shipmentDoc.ref.update({ failureReason: sanitizeSensitiveText(webhookFailureReason).slice(0, 500), updatedAt: now() })
    }
    await logRef.update({ processingStatus: 'PROCESSED', processedAt: now(), duplicateBusinessEffect: transition.duplicate, updatedAt: now() })
    response.status(200).json({ ok: true, duplicate: transition.duplicate })
  } catch (error) {
    await logRef.update({ processingStatus: 'FAILED', errorMessage: sanitizeSensitiveText(error instanceof Error ? error.message : 'Webhook processing failed'), updatedAt: now() })
    response.status(500).send('Webhook processing failed')
  }
})

export const quoteShipment = onCall(async (_request: CallableRequest<{ storeId?: string; orderId?: string; governorate?: string }>) => {
  throw new HttpsError('failed-precondition', 'خيارات الشحن تُحسب الآن عبر getShippingOptions')
})

export const assignShipment = onCall(async (_request: CallableRequest<{ orderId?: string; shippingCompanyId?: string; idempotencyKey?: string }>) => {
  throw new HttpsError('failed-precondition', 'إنشاء الشحنات يتم الآن عبر createOrderShipment')
})

export const submitShippingReview = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { shipmentId, overallRating, pickupSpeed, deliverySpeed, reliability, shipmentCondition, supportQuality, comment } = request.data || {}
  if (!shipmentId) throw new HttpsError('invalid-argument', 'shipmentId مطلوب')
  const shipmentRef = db.doc(`shipments/${shipmentId}`)
  return db.runTransaction(async (tx) => {
    const shipmentSnap = await tx.get(shipmentRef)
    if (!shipmentSnap.exists) throw new HttpsError('not-found', 'الشحنة غير موجودة')
    const shipment = shipmentSnap.data()!
    await assertStoreAccess(request, shipment.storeId, 'orders:view')
    if (!['DELIVERED', 'RETURNED', 'RETURNED_TO_SENDER'].includes(String(shipment.status))) throw new HttpsError('failed-precondition', 'المراجعة متاحة بعد اكتمال الشحنة فقط')
    const values = { overallRating, pickupSpeed, deliverySpeed, reliability, shipmentCondition, supportQuality }
    for (const value of Object.values(values)) if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5) throw new HttpsError('invalid-argument', 'التقييمات يجب أن تكون من 1 إلى 5')
    const reviewRef = db.doc(`shippingCompanyReviews/${shipmentId}`)
    const existing = await tx.get(reviewRef)
    if (existing.exists) throw new HttpsError('already-exists', 'تمت مراجعة هذه الشحنة مسبقاً')
    tx.create(reviewRef, { id: shipmentId, merchantId: request.auth!.uid, storeId: shipment.storeId, shipmentId, orderId: shipment.orderId, shippingCompanyId: shipment.shippingCompanyId, overallRating, pickupSpeed, deliverySpeed, reliability, shipmentCondition, supportQuality, comment: String(comment || '').slice(0, 2000), submittedAt: now(), verified: true, moderation: { hidden: false }, createdAt: now() })
    const companyRef = shipment.shippingCompanyId ? db.doc(`shippingCompanies/${shipment.shippingCompanyId}`) : null
    const companySnap = companyRef ? await tx.get(companyRef) : null
    if (companyRef && companySnap?.exists) {
      const c = companySnap.data() || {}
      const count = Number(c.reviewsCount || 0)
      const average = Number(c.averageRating || 0)
      tx.update(companyRef, { averageRating: (average * count + Number(overallRating)) / (count + 1), reviewsCount: count + 1, updatedAt: now() })
    }
    return { ok: true, reviewId: shipmentId }
  })
})

export const updateShipmentStatus = onCall(async (request: CallableRequest<{ shipmentId?: string; status?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { shipmentId, status } = request.data || {}
  if (!shipmentId || !status) throw new HttpsError('invalid-argument', 'shipmentId و status مطلوبان')
  const legacyStatusAliases: Record<string, string> = { ASSIGNED: 'CREATED', READY: 'READY_FOR_PICKUP', RETURNED_TO_SENDER: 'RETURNED', REPLACED: 'CANCELLED' }
  const normalizedStatus = legacyStatusAliases[String(status)] || String(status)
  const allowed = ['CREATED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNING', 'RETURNED', 'CANCELLED']
  if (!allowed.includes(normalizedStatus)) throw new HttpsError('invalid-argument', 'حالة شحنة غير صالحة')
  const shipmentRef = db.doc(`shipments/${shipmentId}`)
  // Authorize before entering the transaction. This avoids non-transactional
  // reads from assertStoreAccess interleaved with transactional reads/writes.
  const currentShipmentSnap = await shipmentRef.get()
  if (!currentShipmentSnap.exists) throw new HttpsError('not-found', 'الشحنة غير موجودة')
  await assertStoreAccess(request, currentShipmentSnap.data()!.storeId, ['orders:edit', 'orders:status'])
  const currentShipment = currentShipmentSnap.data() || {}
  const providerSnap = await db.doc(`shippingProviders/${String(currentShipment.providerId || '')}`).get()
  const integrationType = String(currentShipment.integrationType || providerSnap.data()?.integrationType || 'manual')
  if (integrationType === 'api') {
    throw new HttpsError('failed-precondition', 'حالة شحنة API تأتي من شركة الشحن. استخدم «تحديث من الشركة» فقط.')
  }
  const transitionGraph: Record<string, string[]> = {
    CREATED: ['READY_FOR_PICKUP', 'CANCELLED'],
    READY_FOR_PICKUP: ['PICKED_UP', 'CANCELLED'],
    PICKED_UP: ['IN_TRANSIT', 'RETURNING'],
    IN_TRANSIT: ['OUT_FOR_DELIVERY', 'RETURNING'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED', 'RETURNING'],
    FAILED: ['OUT_FOR_DELIVERY', 'RETURNING'],
    RETURNING: ['RETURNED'],
    DELIVERED: [], RETURNED: [], CANCELLED: [],
  }
  if (!transitionGraph[String(currentShipment.status || 'CREATED')]?.includes(normalizedStatus)) {
    throw new HttpsError('failed-precondition', 'هذا الانتقال غير متاح لحالة الشحنة الحالية')
  }

  const transition = await db.runTransaction(async (tx) => {
    const snap = await tx.get(shipmentRef)
    if (!snap.exists) throw new HttpsError('not-found', 'الشحنة غير موجودة')
    const shipment = snap.data()!
    if (shipment.status === normalizedStatus) return { orderChanged: false, storeId: shipment.storeId, previousOrderStatus: null, totalPrice: 0 }
    if (['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNING', 'RETURNED'].includes(String(shipment.status))) {
      if (normalizedStatus === 'CANCELLED') throw new HttpsError('failed-precondition', 'لا يمكن إلغاء شحنة بعد الاستلام')
    }

    const orderRef = db.doc(`orders/${shipment.orderId}`)
    const orderSnap = await tx.get(orderRef)
    if (!orderSnap.exists || orderSnap.data()?.storeId !== shipment.storeId) {
      throw new HttpsError('failed-precondition', 'الطلب المرتبط بالشحنة غير صالح')
    }
    const order = orderSnap.data()!

    // A RETURNED provider event is another path into the canonical returned
    // order state. Restore inventory in the same transaction and guard it with
    // the same durable stockRestored flag used by updateOrderStatus so retries
    // and duplicate provider events can never restore twice.
    const shouldRestore = normalizedStatus === 'RETURNED' && order.stockRestored !== true
    const productSnapshots: Array<{ ref: DocumentReference; data: any }> = []
    if (shouldRestore) {
      for (const item of order.items || []) {
        const productRef = db.doc(`products/${item.productId}`)
        const productSnap = await tx.get(productRef)
        if (productSnap.exists && productSnap.data()?.storeId === shipment.storeId) {
          productSnapshots.push({ ref: productRef, data: productSnap.data() })
        }
      }
    }

    if (normalizedStatus === 'DELIVERED' || normalizedStatus === 'RETURNED') {
      // Legacy review metrics are updated only for legacy shipments. Canonical
      // provider status changes must never touch shippingCompanies.
      const companyRef = shipment.shippingCompanyId ? db.doc(`shippingCompanies/${shipment.shippingCompanyId}`) : null
      const companySnap = companyRef ? await tx.get(companyRef) : null
      if (companyRef && companySnap?.exists && !['DELIVERED', 'RETURNED'].includes(String(shipment.status))) {
        const c = companySnap.data() || {}
        const completed = Number(c.completedShipments || 0)
        const success = Number(c.deliverySuccessRate || 0)
        tx.update(companyRef, { completedShipments: completed + 1, deliverySuccessRate: (success * completed + (normalizedStatus === 'DELIVERED' ? 100 : 0)) / (completed + 1), updatedAt: now() })
      }
    }

    if (shouldRestore) {
      for (const item of order.items || []) {
        const entry = productSnapshots.find(({ ref }) => ref.id === item.productId)
        if (!entry) continue
        const product = entry.data
        let variant: any = null
        if (Array.isArray(product.variants)) {
          if (item.variantId) variant = product.variants.find((value: any) => value.id === item.variantId) || null
          if (!variant) {
            const color = item.color || ''
            const size = item.size || ''
            variant = product.variants.find((value: any) => (value.color || '') === color && (value.size || '') === size)
              || (color ? product.variants.find((value: any) => (value.color || '') === color && !(value.size || '')) : null)
              || (size ? product.variants.find((value: any) => !(value.color || '') && (value.size || '') === size) : null)
              || null
          }
        }
        if (variant) {
          variant.stock = Number(variant.stock || 0) + Number(item.quantity || 0)
          const aggregateStock = product.variants.reduce((sum: number, value: any) => sum + Number(value.stock || 0), 0)
          tx.update(entry.ref, { variants: product.variants, stock: aggregateStock, updatedAt: now() })
        } else if (!Array.isArray(product.variants) || product.variants.length === 0) {
          tx.update(entry.ref, { stock: FieldValue.increment(Number(item.quantity || 0)), updatedAt: now() })
        }
      }
    }

    tx.update(shipmentRef, {
      status: normalizedStatus,
      currentStatus: normalizedStatus,
      active: !['CANCELLED', 'DELIVERED', 'RETURNED'].includes(normalizedStatus),
      events: FieldValue.arrayUnion({ status: normalizedStatus, at: Timestamp.now(), source: 'merchant-manual' }),
      updatedAt: now(),
      ...(normalizedStatus === 'DELIVERED' || normalizedStatus === 'RETURNED' ? { completedAt: now() } : {}),
    })
    const nextOrderStatus = ['CREATED', 'READY_FOR_PICKUP'].includes(normalizedStatus)
      ? 'PROCESSING'
      : ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(normalizedStatus)
      ? 'SHIPPED'
      : normalizedStatus === 'DELIVERED'
        ? 'DELIVERED'
        : normalizedStatus === 'RETURNED'
          ? 'RETURNED'
          : null
    tx.update(orderRef, {
      ...(nextOrderStatus ? { status: nextOrderStatus } : {}),
      shipmentStatus: normalizedStatus,
      statusHistory: FieldValue.arrayUnion({ status: nextOrderStatus || order.status || 'NEW', shipmentStatus: normalizedStatus, at: Timestamp.now(), by: request.auth!.uid, source: 'shipment' }),
      ...(shouldRestore ? { stockRestored: true } : {}),
      updatedAt: now(),
    })
    return {
      orderChanged: Boolean(nextOrderStatus && order.status !== nextOrderStatus),
      storeId: shipment.storeId,
      previousOrderStatus: String(order.status || 'NEW'),
      nextOrderStatus,
      totalPrice: Number(order.totalPrice || 0),
    }
  })

  if (transition.orderChanged && transition.nextOrderStatus) {
    let revenueDelta = 0
    if (transition.previousOrderStatus !== 'DELIVERED' && transition.nextOrderStatus === 'DELIVERED') revenueDelta = transition.totalPrice
    if (transition.previousOrderStatus === 'DELIVERED' && transition.nextOrderStatus !== 'DELIVERED') revenueDelta = -transition.totalPrice
    await bumpAnalytics(transition.storeId, { totalPrice: transition.totalPrice, status: transition.nextOrderStatus, revenueDelta }).catch(() => {})
  }
  return { ok: true, status: normalizedStatus }
})

// ─────────────────────────────────────────────────────────────
// 5. updateOrderStatus — restore stock on CANCELLED/RETURNED
// ─────────────────────────────────────────────────────────────
export const updateOrderStatus = onCall(async (request: CallableRequest<{ orderId?: string; status?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { orderId, status } = request.data || {}
  if (!orderId || !status) throw new HttpsError('invalid-argument', 'orderId و status مطلوبان')

  const valid = ['NEW', 'CONTACTED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED']
  if (!valid.includes(status)) throw new HttpsError('invalid-argument', 'حالة غير صالحة')

  const orderRef = db.doc(`orders/${orderId}`)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) throw new HttpsError('not-found', 'الطلب غير موجود')
  const order = orderSnap.data()!

  const role = await getUserRole(request.auth.uid)
  if (role === 'superAdmin') {
    // ok
  } else {
    await assertStoreAccess(request, order.storeId, ['orders:edit', 'orders:status', 'orders:cancel'])
  }

  // Once a shipment exists, its lifecycle is the only source of truth for
  // dispatch, delivery, return and cancellation. This prevents the order UI
  // from claiming "shipped" while an API carrier still reports "created".
  if (order.activeShipmentId && ['SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'].includes(String(status))) {
    throw new HttpsError('failed-precondition', 'حدّث حالة الشحنة من بطاقة الشحن؛ حالة الطلب ستتزامن تلقائياً.')
  }

  assertOrderTransition(String(order.status || 'NEW'), status)
  if (String(order.status || 'NEW') === status) return { ok: true, changed: false, status }

  // Durable idempotency for stock restoration: a cancelled/returned order must
  // restore exactly once, no matter which path crosses into a cancelled state.
  // We key the guard on the persisted `stockRestored` flag (not on the *previous*
  // status), so sequences like NEW -> CANCELLED -> DELIVERED -> CANCELLED, or
  // NEW -> CANCELLED -> CANCELLED, restore only on the first cancellation and
  // never again. The flag is written inside the same transaction that restores.
  const becomesCancelled = ['CANCELLED', 'RETURNED'].includes(status)
  const statusEventId = `order-${orderId}-${status}-${Date.now()}`

  await db.runTransaction(async (tx) => {
    if (becomesCancelled && !(order.stockRestored || false)) {
      for (const item of order.items || []) {
        const productRef = db.doc(`products/${item.productId}`)
        const productSnap = await tx.get(productRef)
        if (!productSnap.exists) continue
        const product = productSnap.data()!
        // Match the exact variant: prefer variantId, then color+size, then
        // color-only / size-only for legacy items. (Same resolution order as
        // createOrder so a cancel/restore always targets the same stock unit.)
        let variant: any = null
        if (Array.isArray(product.variants)) {
          if (item.variantId) {
            variant = product.variants.find((v: any) => v.id === item.variantId) || null
          }
          if (!variant) {
            const normColor = item.color || ''
            const normSize = item.size || ''
            variant =
              product.variants.find((v: any) => (v.color || '') === normColor && (v.size || '') === normSize) ||
              (normColor ? product.variants.find((v: any) => (v.color || '') === normColor && !(v.size || '')) || null : null) ||
              (normSize ? product.variants.find((v: any) => !(v.color || '') && (v.size || '') === normSize) || null : null) ||
              null
          }
        }
        // Restore ONLY the matched variant and recompute the derived aggregate;
        // never increment the flat `stock` independently (would double-count
        // the same units that were already rolled into the per-variant stock).
        if (variant) {
          variant.stock = (variant.stock || 0) + item.quantity
          const aggStock = product.variants.reduce((s: number, v: any) => s + (v.stock || 0), 0)
          tx.update(productRef, { variants: product.variants, stock: aggStock })
        } else {
          tx.update(productRef, { stock: FieldValue.increment(item.quantity) })
        }
      }
    }
    tx.update(orderRef, {
      status,
      statusHistory: FieldValue.arrayUnion({ status, at: Timestamp.now(), by: request.auth!.uid }),
      // Persist the restoration marker so subsequent cancelled-state transitions
      // cannot restore the same stock again.
      ...(becomesCancelled ? { stockRestored: true } : {}),
      updatedAt: now(),
    })
    const eventType = status === 'PROCESSING'
      ? 'order.confirmed'
      : status === 'CANCELLED' || status === 'RETURNED'
        ? 'order.cancelled'
        : null
    if (eventType) {
      emitIntegrationEvent(db, tx, {
        eventId: statusEventId,
        storeId: order.storeId,
        eventType,
        entityType: 'order',
        entityId: orderId,
        payload: { orderId, previousStatus: order.status, status },
      })
    }
  })

  // Revenue is counted only for DELIVERED orders (canonical rule). Entering
  // DELIVERED adds the order value; leaving DELIVERED subtracts it. The order
  // count itself is not re-incremented on status changes.
  let revenueDelta = 0
  if (order.status !== 'DELIVERED' && status === 'DELIVERED') revenueDelta = order.totalPrice || 0
  if (order.status === 'DELIVERED' && status !== 'DELIVERED') revenueDelta = -(order.totalPrice || 0)
  await bumpAnalytics(order.storeId, { totalPrice: order.totalPrice, status, revenueDelta }).catch(() => {})

  // Adjust the linked sales-link counters to match DELIVERED-only attribution.
  // Orders/revenue are attributed to the link only once the order is delivered.
  if (order.salesLinkId) {
    try {
      const linkRef = db.doc(`storeLinks/${order.salesLinkId}`)
      const linkSnap = await linkRef.get()
      if (linkSnap.exists && linkSnap.data()?.storeId === order.storeId) {
        if (order.status !== 'DELIVERED' && status === 'DELIVERED') {
          await linkRef.update({
            ordersCount: FieldValue.increment(1),
            totalRevenue: FieldValue.increment(order.totalPrice || 0),
            updatedAt: now(),
          })
        } else if (order.status === 'DELIVERED' && status !== 'DELIVERED') {
          await linkRef.update({
            ordersCount: FieldValue.increment(-1),
            totalRevenue: FieldValue.increment(-(order.totalPrice || 0)),
            updatedAt: now(),
          })
        }
      }
    } catch {
      // A stale/removed link must never fail a status update.
    }
  }

  // Adjust the linked landing-page counters to match DELIVERED-only
  // attribution (same canonical rule as sales links).
  if (order.landingPageId) {
    try {
      const landingRef = db.doc(`landingPages/${order.landingPageId}`)
      const landingSnap = await landingRef.get()
      if (landingSnap.exists && landingSnap.data()?.storeId === order.storeId) {
        if (order.status !== 'DELIVERED' && status === 'DELIVERED') {
          await landingRef.update({
            ordersCount: FieldValue.increment(1),
            totalRevenue: FieldValue.increment(order.totalPrice || 0),
            updatedAt: now(),
          })
        } else if (order.status === 'DELIVERED' && status !== 'DELIVERED') {
          await landingRef.update({
            ordersCount: FieldValue.increment(-1),
            totalRevenue: FieldValue.increment(-(order.totalPrice || 0)),
            updatedAt: now(),
          })
        }
      }
    } catch {
      // A stale/removed landing page must never fail a status update.
    }
  }

  // Campaign attribution follows the same delivered-only accounting rule as
  // sales links and landing pages. Stale campaign records never block order
  // state transitions.
  if (order.campaignId) {
    try {
      const campaignRef = db.doc(`adCampaigns/${order.campaignId}`)
      const campaignSnap = await campaignRef.get()
      if (campaignSnap.exists && campaignSnap.data()?.storeId === order.storeId) {
        const delta = order.status !== 'DELIVERED' && status === 'DELIVERED' ? 1 : order.status === 'DELIVERED' && status !== 'DELIVERED' ? -1 : 0
        if (delta) await campaignRef.update({ attributedOrders: FieldValue.increment(delta), attributedRevenue: FieldValue.increment(delta * (order.totalPrice || 0)), updatedAt: now() })
      }
    } catch {
      // Attribution is non-critical bookkeeping and must not block fulfillment.
    }
  }

  await auditLog(order.storeId, request.auth.uid, 'update_order_status', 'orders', orderId, { from: order.status, to: status })

  // CRM Timeline: log status change for the linked customer
  if (order.customerDocId) {
    const timelineType = status === 'CANCELLED' ? 'order.cancelled' : status === 'RETURNED' ? 'order.returned' : 'order.status_changed'
    const title = status === 'CANCELLED' ? `إلغاء الطلب ${order.orderNumber}` : status === 'RETURNED' ? `مرتجع ${order.orderNumber}` : `تغيير حالة ${order.orderNumber} إلى ${status}`
    await logCustomerEvent(order.storeId, order.customerDocId, timelineType, title, {
      body: `${order.status} → ${status}`,
      orderId,
      orderNumber: order.orderNumber,
      createdBy: request.auth.uid,
      meta: { from: order.status, to: status },
    }).catch(() => {})
  }

  return { ok: true }
})

/** Platform-only operational diagnostics for the outbox entries created by one order. */
export const getOrderIntegrationEvents = onCall(async (request: CallableRequest<{ orderId?: string }>) => {
  await assertPlatformAdmin(request)
  const orderId = String(request.data?.orderId || '').trim()
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId مطلوب')
  const snapshot = await db.collection('integrationEvents').where('entityId', '==', orderId).limit(20).get()
  return {
    events: snapshot.docs.map((doc) => {
      const data = doc.data() || {}
      return {
        id: doc.id,
        eventType: data.eventType || null,
        processingStatus: data.processingStatus || 'PENDING',
        outcome: data.outcome || null,
        errorCode: data.errorCode || null,
        errorMessage: sanitizeSensitiveText(String(data.errorMessage || '')) || null,
        createdAt: data.createdAt || null,
        processedAt: data.processedAt || null,
      }
    }),
  }
})

// ─────────────────────────────────────────────────────────────
// 6. impersonate — platform admin logs into a merchant session
// ─────────────────────────────────────────────────────────────
export const impersonate = onCall(async (request: CallableRequest<{ storeId?: string }>) => {
  await assertPlatformAdmin(request)
  const { storeId } = request.data || {}
  if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists) throw new HttpsError('not-found', 'المتجر غير موجود')
  const ownerId = storeSnap.data()!.ownerId

  const token = await auth.createCustomToken(ownerId)
  const expiry = tsFromDate(new Date(Date.now() + 15 * 60000))

  await db.doc(`users/${ownerId}`).update({
    impersonatedBy: request.auth!.uid,
    impersonatedUntil: expiry,
  })

  return { customToken: token, storeId }
})

// ─────────────────────────────────────────────────────────────
// 7. exitImpersonation — platform admin leaves a merchant session
// ─────────────────────────────────────────────────────────────
export const exitImpersonation = onCall(async (request: CallableRequest) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const snap = await db.doc(`users/${request.auth.uid}`).get()
  const user = snap.data()
  if (!user) throw new HttpsError('not-found', 'الحساب غير موجود')
  if (!user.impersonatedBy) {
    // nothing to exit — not an impersonated session
    return { ok: true }
  }
  const adminUid = user.impersonatedBy
  await db.doc(`users/${request.auth.uid}`).update({
    impersonatedBy: FieldValue.delete(),
    impersonatedUntil: FieldValue.delete(),
  })
  // Record the exit in the admin's audit trail
  await db.collection('auditLogs').add({
    storeId: null,
    userId: adminUid,
    action: 'impersonation_exited',
    resource: 'users',
    resourceId: request.auth.uid,
    createdAt: now(),
    createdBy: adminUid,
  })
  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// 8. trackOrder — public order tracking. Requires BOTH storeId + phone +
//    orderNumber so a caller must know both the order identifier and the
//    customer phone. Returns only a safe subset (no address/PII). Never leaks
//    other stores' orders (scoped by storeId) or another phone's orders.
// ─────────────────────────────────────────────────────────────
// Simple per-phone sliding-window guard against brute-forcing sequential
// ORD-NNNNN numbers. In-memory (not durable across cold starts) — sufficient
// to slow enumeration; per-instance only.
const trackOrderBuckets = new Map<string, number[]>()
const TRACK_WINDOW_MS = 60 * 1000
const TRACK_MAX_PER_WINDOW = 10

function throttleTrack(phone: string) {
  const nowMs = Date.now()
  const bucket = (trackOrderBuckets.get(phone) || []).filter((t) => nowMs - t < TRACK_WINDOW_MS)
  if (bucket.length >= TRACK_MAX_PER_WINDOW) return false
  bucket.push(nowMs)
  trackOrderBuckets.set(phone, bucket)
  return true
}

export const trackOrder = onCall(async (request: CallableRequest<{ storeId?: string; phone?: string; orderNumber?: string }>) => {
  const { storeId, phone, orderNumber } = request.data || {}
  if (!storeId || !phone || !orderNumber) throw new HttpsError('invalid-argument', 'storeId و phone و orderNumber مطلوبة')
  if (!/^\d{9,15}$/.test(String(phone))) throw new HttpsError('invalid-argument', 'رقم هاتف غير صالح')
  if (!throttleTrack(String(phone))) {
    throw new HttpsError('resource-exhausted', 'طلبات كثيرة — حاول بعد قليل')
  }

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) {
    throw new HttpsError('not-found', 'المتجر غير موجود')
  }

  const normalized = String(orderNumber).trim().toUpperCase()
  if (!normalized.startsWith('ORD-')) throw new HttpsError('invalid-argument', 'رقم طلب غير صالح')

  const snap = await db.collection('orders')
    .where('storeId', '==', storeId)
    .where('orderNumber', '==', normalized)
    .where('phone', '==', String(phone))
    .limit(10)
    .get()

  const orders = await Promise.all(snap.docs.map(async (d) => {
    const o = d.data()
    const shipmentSnap = o.activeShipmentId ? await db.doc(`shipments/${o.activeShipmentId}`).get() : null
    const shipment = shipmentSnap?.exists ? shipmentSnap.data() || {} : {}
    return {
      id: d.id,
      orderNumber: o.orderNumber,
      status: o.status,
      statusHistory: Array.isArray(o.statusHistory) ? o.statusHistory : null,
      items: Array.isArray(o.items) ? o.items.map((i: any) => ({ name: i.name, quantity: i.quantity, color: i.color || '', size: i.size || '' })) : [],
      subtotal: o.subtotal || 0,
      shippingFee: o.shippingFee || 0,
      shippingMethod: o.shippingMethod || o.shippingSnapshot?.serviceName || null,
      shippingProviderName: o.shippingProviderName || o.shippingSnapshot?.providerName || null,
      totalPrice: o.totalPrice || 0,
      paymentMethod: o.paymentMethod || 'cod',
      customerType: o.customerType || 'guest',
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      shipment: shipmentSnap?.exists ? {
        providerName: shipment.providerName || null,
        status: shipment.status || null,
        trackingNumber: String(shipment.provider || shipment.providerId || '').toLowerCase() === 'wasla'
          ? waslaPublicTrackingCode(shipment.trackingNumber) || waslaPublicTrackingCode(shipment.providerShipmentId) || shipment.trackingNumber || shipment.providerShipmentId || shipment.externalShipmentId || null
          : shipment.trackingNumber || shipment.providerShipmentId || shipment.externalShipmentId || null,
        trackingUrl: shipment.trackingUrl || null,
        failureReason: shipment.failureReason || null,
        updatedAt: shipment.updatedAt || null,
      } : null,
    }
  }))

  return { orders }
})

// ─────────────────────────────────────────────────────────────
// 8b. claimOrder — link a guest order to a newly-registered customer account.
//     Requires auth + the same (storeId, orderNumber, phone) identity used at
//     checkout. Marks the order as registered without creating a duplicate.
// ─────────────────────────────────────────────────────────────
export const claimOrder = onCall(async (request: CallableRequest<{ storeId?: string; orderNumber?: string; phone?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, orderNumber, phone } = request.data || {}
  if (!storeId || !phone || !orderNumber) throw new HttpsError('invalid-argument', 'storeId و phone و orderNumber مطلوبة')
  if (!/^\d{9,15}$/.test(String(phone))) throw new HttpsError('invalid-argument', 'رقم هاتف غير صالح')

  const normalized = String(orderNumber).trim().toUpperCase()
  if (!normalized.startsWith('ORD-')) throw new HttpsError('invalid-argument', 'رقم طلب غير صالح')

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) {
    throw new HttpsError('not-found', 'المتجر غير موجود')
  }

  // Only allow claiming orders scoped by storeId + phone so a customer can
  // never claim another store's or another phone's order.
  const snap = await db.collection('orders')
    .where('storeId', '==', storeId)
    .where('orderNumber', '==', normalized)
    .where('phone', '==', String(phone))
    .limit(1)
    .get()
  if (snap.empty) throw new HttpsError('not-found', 'لا يوجد طلب مطابق لهذه البيانات')

  const orderRef = snap.docs[0].ref
  const order = snap.docs[0].data()

  // Guard against claiming an order that already belongs to another account.
  if (order.customerId && order.customerId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'هذا الطلب مرتبط بحساب آخر')
  }

  // If already claimed by this user, idempotently succeed — never duplicate.
  if (order.customerId === request.auth.uid && order.customerType === 'registered') {
    return { ok: true, orderId: orderRef.id, already: true }
  }

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(orderRef)
    if (!fresh.exists) throw new HttpsError('not-found', 'الطلب غير موجود')
    const current = fresh.data()!
    if (current.customerId && current.customerId !== request.auth!.uid) {
      throw new HttpsError('permission-denied', 'هذا الطلب مرتبط بحساب آخر')
    }

    // All reads must happen before any writes within the transaction. Look up
    // the matching customer doc (same storeId + phone identity used at checkout)
    // before issuing any tx.update.
    const custSnap = await tx.get(db.collection('customers')
      .where('storeId', '==', storeId)
      .where('phone', '==', String(phone))
      .limit(1))

    tx.update(orderRef, {
      customerId: request.auth!.uid,
      customerType: 'registered',
      updatedAt: now(),
    })

    // Mark the matching customer doc as registered + link the account uid. The
    // same (storeId, phone) identity used at checkout, so no cross-store match.
    if (!custSnap.empty) {
      tx.update(custSnap.docs[0].ref, {
        type: 'registered',
        userId: request.auth!.uid,
        updatedAt: now(),
      })
    }
  })

  await auditLog(storeId, request.auth.uid, 'claim_order', 'orders', orderRef.id, { orderNumber: normalized, phone: String(phone) })

  return { ok: true, orderId: orderRef.id, already: false }
})

// ─────────────────────────────────────────────────────────────
// 9. recordStoreLinkVisit — count a visit on a sales link.
//    Validates the link belongs to the store. Clients should
//    throttle calls (per session) to avoid inflating counts.
// ─────────────────────────────────────────────────────────────
export const recordStoreLinkVisit = onCall(async (request: CallableRequest<{ storeId?: string; code?: string }>) => {  const { storeId, code } = request.data || {}
  if (!storeId || !code) throw new HttpsError('invalid-argument', 'storeId و code مطلوبان')
  const normalizedCode = String(code).trim().toLowerCase()

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) {
    throw new HttpsError('not-found', 'المتجر غير موجود')
  }

  const linkQuery = await db
    .collection('storeLinks')
    .where('storeId', '==', storeId)
    .where('code', '==', normalizedCode)
    .limit(1)
    .get()

  if (linkQuery.empty) {
    // Unknown code for this store — ignore silently (never leak link existence).
    return { ok: false }
  }

  await linkQuery.docs[0].ref.update({
    visits: FieldValue.increment(1),
    lastVisitAt: now(),
  })

  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// 9c. recordLandingPageView — count a view on a landing page.
//     Validates the page is active + published and its store is
//     active. Clients throttle to once per session.
// ─────────────────────────────────────────────────────────────
export const recordLandingPageView = onCall(async (request: CallableRequest<{ landingPageId?: string }>) => {
  const { landingPageId } = request.data || {}
  if (!landingPageId) throw new HttpsError('invalid-argument', 'landingPageId مطلوب')

  const landingSnap = await db.doc(`landingPages/${landingPageId}`).get()
  if (!landingSnap.exists) return { ok: false }
  const landing = landingSnap.data()!
  if (!landing.active || landing.status !== 'published') return { ok: false }

  const storeSnap = await db.doc(`stores/${landing.storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) return { ok: false }

  await landingSnap.ref.update({
    views: FieldValue.increment(1),
    lastViewAt: now(),
  })

  return { ok: true }
})

// ─────────────────────────────────────────────────────────────
// 9b. resolveStoreLink — public resolver for the short `/s/:code` URL.
//     Returns only the destination info needed to redirect (store slug +
//     destination). Never leaks internal fields (staffId, revenue, …). Only
//     active, non-archived links resolve. The caller records the click via
//     recordStoreLinkVisit once the storefront has loaded (StoreSlugLoader).
// ─────────────────────────────────────────────────────────────
export const resolveStoreLink = onCall(async (request: CallableRequest<{ code?: string }>) => {
  const { code } = request.data || {}
  if (!code) throw new HttpsError('invalid-argument', 'code مطلوب')
  const normalizedCode = String(code).trim().toLowerCase()

  const linkQuery = await db
    .collection('storeLinks')
    .where('code', '==', normalizedCode)
    .where('active', '==', true)
    .limit(1)
    .get()

  if (linkQuery.empty) {
    return { ok: false }
  }
  const link = linkQuery.docs[0]
  const linkData = link.data()
  if (linkData.archived) return { ok: false }

  const storeSnap = await db.doc(`stores/${linkData.storeId}`).get()
  if (!storeSnap.exists) return { ok: false }
  const store = storeSnap.data() as any
  if (!store?.active || !store?.published || !store?.slug) return { ok: false }

  return {
    ok: true,
    storeSlug: store.slug,
    destinationType: linkData.destinationType || 'home',
    destinationId: linkData.destinationId || null,
    title: linkData.title || linkData.name || '',
  }
})

// ─────────────────────────────────────────────────────────────
// 10. inviteStaff — provision a real staff login for a merchant tenant.
//     The owner (or a staff member with team:manage) invites a colleague.
//     This creates the Firebase Auth user + the users/{uid} doc (role 'staff')
//     with permissions copied from the chosen role, plus the team + invitation
//     records. Returns the one-time initial password for the merchant to pass
//     to the staff member out-of-band.
// ─────────────────────────────────────────────────────────────
async function reserveStaffSlot(storeId: string, limit: number): Promise<void> {
  if (limit <= 0) return
  const counterRef = db.doc(`stores/${storeId}/counters/staff`)
  await db.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef)
    let used = Number(counterSnap.exists ? counterSnap.data()?.active : NaN)
    if (!Number.isFinite(used)) {
      const members = await tx.get(db.collection('team').where('storeId', '==', storeId).where('active', '==', true))
      used = members.size
    }
    if (used >= limit) throw new HttpsError('resource-exhausted', `تم تجاوز حد أعضاء الفريق (${limit})`)
    tx.set(counterRef, { storeId, active: used + 1, updatedAt: now() }, { merge: true })
  })
}

async function releaseStaffSlot(storeId: string): Promise<void> {
  const counterRef = db.doc(`stores/${storeId}/counters/staff`)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef)
    if (!snap.exists) return
    tx.update(counterRef, { active: Math.max(0, Number(snap.data()?.active || 0) - 1), updatedAt: now() })
  }).catch(() => {})
}

export const inviteStaff = onCall(async (request: CallableRequest<{ storeId?: string; name?: string; email?: string; roleId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, name, email, roleId } = request.data || {}
  if (!storeId || !name || !email || !roleId) {
    throw new HttpsError('invalid-argument', 'بيانات الدعوة غير مكتملة')
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'بريد إلكتروني غير صالح')
  }

  // Only the store owner (merchant) or a staff member holding team:manage.
  await assertStoreAccess(request, storeId, 'team:invite')

  // The chosen role must belong to this store.
  const roleSnap = await db.doc(`roles/${roleId}`).get()
  if (!roleSnap.exists || roleSnap.data()?.storeId !== storeId) {
    throw new HttpsError('not-found', 'الدور غير موجود')
  }
  const permissions = roleSnap.data()?.permissions || []

  // Enforce the plan's staffLimit server-side.
  const grant = await grantForStore(storeId, request.auth.uid)
  if (!grant) throw new HttpsError('failed-precondition', 'الاشتراك غير نشط — لا يمكن إضافة أعضاء فريق الآن')
  const staffLimit = Number(grant.plan?.staffLimit || 0)

  // No account may already exist with this email.
  const existing = await db.collection('users').where('email', '==', String(email).toLowerCase()).get()
  if (!existing.empty) {
    throw new HttpsError('already-exists', 'هذا البريد مستخدم مسبقاً')
  }

  await reserveStaffSlot(storeId, staffLimit)

  const uid = db.collection('users').doc().id
  // Authentication credentials and invitation identifiers must come from a
  // cryptographically secure source; Math.random() is predictable and is not
  // suitable for account provisioning.
  const initialPassword = randomBytes(18).toString('base64url')

  try {
    await auth.createUser({ uid, email, password: initialPassword, displayName: name, disabled: false })
  } catch (err: any) {
    await releaseStaffSlot(storeId)
    if (err?.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'هذا البريد مستخدم مسبقاً')
    }
    throw new HttpsError('internal', err?.message || 'تعذر إنشاء الحساب')
  }

  await db.doc(`users/${uid}`).set({
    uid,
    email,
    name,
    role: 'staff',
    storeIds: [storeId],
    active: true,
    permissions,
    createdBy: request.auth.uid,
    createdAt: now(),
    updatedAt: now(),
  })

  const teamId = db.collection('team').doc().id
  await db.doc(`team/${teamId}`).set({
    storeId,
    userId: uid,
    email,
    name,
    role: roleId,
    active: true,
    createdBy: request.auth.uid,
    createdAt: now(),
    updatedAt: now(),
  })

  const invitationId = db.collection('invitations').doc().id
  await db.doc(`invitations/${invitationId}`).set({
    storeId,
    email,
    role: roleId,
    token: randomBytes(32).toString('base64url'),
    status: 'accepted',
    invitedBy: request.auth.uid,
    createdAt: now(),
    updatedAt: now(),
  })

  await db.collection('notifications').add({
    storeId,
    userId: null,
    title: 'تمت إضافة موظف جديد',
    body: `تم إنشاء حساب الموظف ${name} بدور محدد. سلّم بيانات الدخول للموظف.`,
    type: 'team',
    read: false,
    createdBy: request.auth.uid,
    createdAt: now(),
  })

  await auditLog(storeId, request.auth.uid, 'invite_staff', 'users', uid, { email, role: roleId })

  return { uid, email, initialPassword }
})

// ─────────────────────────────────────────────────────
// 6a. Scheduled maintenance jobs (idempotent, retryable, no frontend).
// ─────────────────────────────────────────────────────

const SCHEDULE_TIMEZONE = 'Africa/Cairo'
// Trial-expired / expired-but-unpaid merchants get this grace window before the
// scheduler flips them to `suspended`. Paid (approved) renewals are excluded.
const UNPAID_GRACE_DAYS = 3

// 6b. expireLaunchPricing — disables any plan whose launch offer has an
// `launchExpiresAt` in the past, so promotional pricing never outlives its
// campaign window. Audit-trails each disable; non-blocking.
export const expireLaunchPricing = onSchedule(
  { schedule: '0 2 * * *', timeZone: SCHEDULE_TIMEZONE, retryCount: 3 },
  async () => {
    const nowTs = Timestamp.now()
    const expired = await db
      .collection('plans')
      .where('launchEnabled', '==', true)
      .where('launchExpiresAt', '<=', nowTs)
      .get()
    if (expired.empty) return
    const batch = db.batch()
    for (const doc of expired.docs) batch.update(doc.ref, { launchEnabled: false, launchExpiredAt: now(), updatedAt: now() })
    await batch.commit()
    for (const doc of expired.docs) {
      const data = doc.data() || {}
      await auditLog(null, 'scheduler', 'launch_pricing_expired', 'plans', doc.id, { name: data.name, slug: data.slug }).catch(() => {})
    }
  },
)

// 6c. usageWarnings — emits billing notifications at 80/90/100% of each plan
// quota (orders, products, sales links, staff, storage). Deduped per store +
// resource via a `usageAlerts/{resource}` subcollection so a merchant receives
// exactly one notification per threshold band per billing period.
const USAGE_BANDS = [0, 80, 90, 100] as const
type UsageBand = (typeof USAGE_BANDS)[number]
function bandFor(percent: number): UsageBand {
  if (percent >= 100) return 100
  if (percent >= 90) return 90
  if (percent >= 80) return 80
  return 0
}

async function countWhere(storeId: string, coll: string): Promise<number> {
  try {
    const agg = await db.collection(coll).where('storeId', '==', storeId).count().get()
    return Number(agg.data()?.count || 0)
  } catch {
    const snap = await db.collection(coll).where('storeId', '==', storeId).get()
    return snap.size
  }
}

export const usageWarnings = onSchedule(
  { schedule: '*/30 * * * *', timeZone: SCHEDULE_TIMEZONE, retryCount: 3 },
  async () => {
    const live = await db.collection('subscriptions').where('status', 'in', ['trialing', 'active']).get()
    let notified = 0
    for (const sDoc of live.docs) {
      const sub = sDoc.data() || {}
      const storeId = sub.storeId as string
      if (!storeId) continue
      const [planSnap, storeSnap] = await Promise.all([
        db.doc(`plans/${sub.planId}`).get(),
        db.doc(`stores/${storeId}`).get(),
      ])
      if (!planSnap.exists) continue
      const plan = effectivePlanForSubscription(sub, planSnap.data())
      const store = storeSnap.exists ? storeSnap.data()! : {}

      // { key, label, used, limit } — limit null means unlimited (skipped).
      const orderLimit = Number(plan.orderLimitPerMonth || 0) > 0 ? Number(plan.orderLimitPerMonth || 0) : null
      const checks: { key: string; label: string; used: number; limit: number | null }[] = []
      checks.push({ key: 'orders', label: 'الطلبات', used: Number(sub.ordersUsed || 0), limit: orderLimit })
      const pLimit = resolvedLimit(plan, 'productLimit', 'unlimitedProducts')
      const sLimit = resolvedLimit(plan, 'salesLinksLimit', 'unlimitedSalesLinks')
      const productsCount = pLimit !== null ? await countWhere(storeId, 'products') : 0
      const linksCount = sLimit !== null ? await countWhere(storeId, 'storeLinks') : 0
      // The owner occupies one seat everywhere the merchant sees team usage.
      const staffCount = 1 + await countWhere(storeId, 'team')
      const staffLimit = Number(plan.staffLimit || 0) > 0 ? Number(plan.staffLimit || 0) : 1
      checks.push(
        { key: 'products', label: 'المنتجات', used: productsCount, limit: pLimit },
        { key: 'salesLinks', label: 'روابط البيع', used: linksCount, limit: sLimit },
        { key: 'staff', label: 'أعضاء الفريق', used: staffCount, limit: staffLimit },
        { key: 'storage', label: 'التخزين', used: Number(store.storageUsed || 0), limit: Number(plan.storageLimit) * 1024 * 1024 || null },
      )

      for (const c of checks) {
        // limit null => unlimited (skip); a numeric limit must be > 0 to be a real cap.
        if (c.limit === null || c.limit <= 0) continue
        const percent = Math.min(100, Math.round((c.used / c.limit) * 100))
        const band = bandFor(percent)
        if (band === 0) continue
        const alertRef = db.doc(`stores/${storeId}/usageAlerts/${c.key}`)
        const existing = await alertRef.get()
        const prev = existing.exists ? (existing.data() as any) : {}
        const prevBand = Number(prev.band || 0) as UsageBand
        const prevPeriod = prev.periodNumber ?? null
        // Re-arm when entering a new billing period so warnings re-fire.
        if (prevPeriod === null || prevPeriod !== Number(sub.periodNumber || 0) || band > prevBand) {
          await createBillingNotification(
            storeId,
            null,
            `حد ${c.label} قريب`,
            percent >= 100
              ? `وصلت إلى حد ${c.label} (${c.used} من ${c.limit}). ارفع باقتك لفتح المزيد.`
              : `${c.used} من ${c.limit} ${c.label} مستغلك — استهدف رفع الباقة قريباً.`,
          ).catch(() => {})
          await alertRef.set({ key: c.key, band, periodNumber: Number(sub.periodNumber || 0), percent, notifiedAt: now(), updatedAt: now() }, { merge: true })
          notified++
        }
      }
    }
  },
)

// 6d. suspendUnpaidTrials — flips unpaid/expired trial subscriptions (those that
// never had an approval, i.e. `approvedBy` is absent) into `suspended` after
// the grace window. Paid renewals always carry `approvedBy` and are skipped.
// Merchants can still recover by submitting a payment request (submitPaymentRequest
// accepts `suspended`).
export const suspendUnpaidTrials = onSchedule(
  { schedule: '0 3 * * *', timeZone: SCHEDULE_TIMEZONE, retryCount: 3 },
  async () => {
    const cutoff = Timestamp.fromMillis(Date.now() - UNPAID_GRACE_DAYS * DAY_MS)
    const snap = await db
      .collection('subscriptions')
      .where('status', '==', 'expired')
      .where('approvedBy', '==', null)
      .where('trialEndsAt', '<=', cutoff)
      .get()
    if (snap.empty) return
    const batch = db.batch()
    for (const doc of snap.docs) {
      batch.update(doc.ref, { status: 'suspended', suspendedReason: 'trial_expired_unpaid', updatedAt: now() })
    }
    await batch.commit()
    for (const doc of snap.docs) {
      const data = doc.data() || {}
      await createBillingNotification(data.storeId, null, 'تجربتك منتهية', 'تجربتك المجانية انتهت ولا يزال الاشتراك غير مفعل. فعّل الآن لاستكمال البيع.').catch(() => {})
      await auditLog(data.storeId, 'scheduler', 'trial_suspended', 'subscriptions', doc.id, {}).catch(() => {})
    }
  },
)

// Platform promotions are server-owned. Their effective state is derived from
// timestamps so stale clients can never receive an expired offer.
function promotionState(data: any): string {
  if (data?.status === 'cancelled' || data?.status === 'draft') return data.status
  const nowMs = Date.now()
  const start = data?.startsAt?.toMillis?.() ?? (data?.startsAt ? new Date(data.startsAt).getTime() : 0)
  const end = data?.endsAt?.toMillis?.() ?? (data?.endsAt ? new Date(data.endsAt).getTime() : 0)
  if (end && nowMs >= end) return 'expired'
  if (start && nowMs < start) return 'scheduled'
  return 'active'
}

// Merchant-private manual campaign records. These intentionally do not call
// any advertising provider; they provide a stable attribution foundation for
// later integrations while keeping spend and attribution tenant-isolated.
export const createAdCampaign = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const d = request.data || {}
  if (!d.storeId || !String(d.name || '').trim()) throw new HttpsError('invalid-argument', 'اسم الحملة والمتجر مطلوبان')
  await assertStoreAccess(request, d.storeId, 'reports:view')
  const spend = Number(d.totalSpend ?? 0)
  if (!Number.isFinite(spend) || spend < 0) throw new HttpsError('invalid-argument', 'الإنفاق غير صالح')
  const platform = ['facebook', 'instagram', 'tiktok', 'google', 'other'].includes(d.platform) ? d.platform : 'other'
  const ref = db.collection('adCampaigns').doc()
  await ref.set({
    id: ref.id, storeId: d.storeId, name: String(d.name).trim().slice(0, 160), platform,
    status: ['active', 'paused', 'ended'].includes(d.status) ? d.status : 'active',
    totalSpend: spend, dailyBudget: Number.isFinite(Number(d.dailyBudget)) && Number(d.dailyBudget) >= 0 ? Number(d.dailyBudget) : null,
    attributionMode: ['manual', 'sales_link', 'landing_page', 'campaign_parameter'].includes(d.attributionMode) ? d.attributionMode : 'manual',
    productIds: Array.isArray(d.productIds) ? d.productIds.slice(0, 100) : [],
    attributedOrders: 0, attributedRevenue: 0, createdBy: request.auth.uid, createdAt: now(), updatedAt: now(),
  })
  return { id: ref.id }
})

export const updateAdCampaign = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const d = request.data || {}
  if (!d.campaignId) throw new HttpsError('invalid-argument', 'الحملة مطلوبة')
  const ref = db.doc(`adCampaigns/${d.campaignId}`)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'الحملة غير موجودة')
  await assertStoreAccess(request, snap.data()?.storeId, 'reports:view')
  const patch: Record<string, any> = { updatedAt: now() }
  if (d.name !== undefined) patch.name = String(d.name).trim().slice(0, 160)
  if (d.status !== undefined && ['active', 'paused', 'ended'].includes(d.status)) patch.status = d.status
  if (d.totalSpend !== undefined) { const spend = Number(d.totalSpend); if (!Number.isFinite(spend) || spend < 0) throw new HttpsError('invalid-argument', 'الإنفاق غير صالح'); patch.totalSpend = spend }
  if (d.productIds !== undefined) patch.productIds = Array.isArray(d.productIds) ? d.productIds.slice(0, 100) : []
  await ref.update(patch)
  return { ok: true }
})

export const listAdCampaigns = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = request.data?.storeId
  await assertStoreAccess(request, storeId, 'reports:view')
  const snap = await db.collection('adCampaigns').where('storeId', '==', storeId).orderBy('createdAt', 'desc').get()
  return { campaigns: snap.docs.map((d) => ({ id: d.id, ...d.data(), costPerOrder: Number(d.data().attributedOrders || 0) > 0 ? Number(d.data().totalSpend || 0) / Number(d.data().attributedOrders) : null })) }
})

export const createPlatformPromotion = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request)
  const d = request.data || {}
  if (!d.title || !d.type || !d.audienceType) throw new HttpsError('invalid-argument', 'العنوان والنوع والجمهور مطلوبة')
  if (!['announcement', 'plan_offer', 'maintenance', 'feature_announcement', 'general_offer'].includes(d.type)) throw new HttpsError('invalid-argument', 'نوع العرض غير صالح')
  if (!['all_merchants', 'selected_plans', 'selected_merchants'].includes(d.audienceType)) throw new HttpsError('invalid-argument', 'الجمهور غير صالح')
  const ref = db.collection('platformPromotions').doc()
  const startsAt = d.startsAt ? Timestamp.fromDate(new Date(d.startsAt)) : Timestamp.now()
  const endsAt = d.endsAt ? Timestamp.fromDate(new Date(d.endsAt)) : null
  if (endsAt && endsAt.toMillis() <= startsAt.toMillis()) throw new HttpsError('invalid-argument', 'تاريخ النهاية يجب أن يكون بعد البداية')
  const status = startsAt.toMillis() > Date.now() ? 'scheduled' : 'active'
  const promoPrice = d.promotionalPrice == null ? null : Number(d.promotionalPrice)
  if (promoPrice != null && (!Number.isFinite(promoPrice) || promoPrice < 0)) throw new HttpsError('invalid-argument', 'السعر الترويجي غير صالح')
  const payload = { id: ref.id, title: String(d.title).slice(0, 160), message: String(d.message || '').slice(0, 2000), type: d.type, status, audienceType: d.audienceType, targetPlanIds: Array.isArray(d.targetPlanIds) ? d.targetPlanIds.slice(0, 20) : [], targetMerchantIds: Array.isArray(d.targetMerchantIds) ? d.targetMerchantIds.slice(0, 100) : [], placement: Array.isArray(d.placement) ? d.placement : ['dashboard_banner', 'notification'], ctaLabel: d.ctaLabel || '', ctaType: d.ctaType || '', ctaTarget: d.ctaTarget || '', startsAt, endsAt, planId: d.planId || null, discountType: d.discountType || null, discountValue: Math.max(0, Number(d.discountValue || 0)), promotionalPrice: promoPrice, allowCouponStacking: d.allowCouponStacking === true, createdBy: request.auth!.uid, createdAt: now(), updatedAt: now() }
  await ref.set(payload)
  await auditLog('__platform__', request.auth!.uid, 'promotion_created', 'platformPromotions', ref.id, { audienceType: payload.audienceType, planId: payload.planId }).catch(() => {})
  return { ok: true, promotionId: ref.id, status }
})

export const updatePlatformPromotion = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request)
  const { promotionId, ...changes } = request.data || {}
  if (!promotionId) throw new HttpsError('invalid-argument', 'promotionId مطلوب')
  const ref = db.doc(`platformPromotions/${promotionId}`)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'العرض غير موجود')
  const allowed: Record<string, unknown> = {}
  for (const key of ['title', 'message', 'type', 'audienceType', 'targetPlanIds', 'targetMerchantIds', 'placement', 'ctaLabel', 'ctaType', 'ctaTarget', 'planId', 'discountType', 'discountValue', 'promotionalPrice', 'allowCouponStacking']) if (key in changes) allowed[key] = changes[key]
  if (changes.startsAt) allowed.startsAt = Timestamp.fromDate(new Date(changes.startsAt))
  if (changes.endsAt) allowed.endsAt = Timestamp.fromDate(new Date(changes.endsAt))
  allowed.updatedAt = now()
  await ref.update(allowed)
  return { ok: true }
})

export const setPlatformPromotionStatus = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request)
  const { promotionId, status } = request.data || {}
  if (!promotionId || !['draft', 'active', 'cancelled'].includes(status)) throw new HttpsError('invalid-argument', 'حالة غير صالحة')
  await db.doc(`platformPromotions/${promotionId}`).update({ status, updatedAt: now() })
  await auditLog('__platform__', request.auth!.uid, status === 'active' ? 'promotion_activated' : 'promotion_stopped', 'platformPromotions', promotionId, {}).catch(() => {})
  if (status === 'active') {
    const p = (await db.doc(`platformPromotions/${promotionId}`).get()).data() || {}
    const users = await db.collection('users').where('role', '==', 'merchant').get()
    const targetedStoreIds = new Set<string>()
    if (p.audienceType === 'selected_plans') {
      const subs = await db.collection('subscriptions').where('planId', 'in', (p.targetPlanIds || []).slice(0, 10)).get()
      subs.docs.forEach((s) => { const sid = s.data()?.storeId; if (sid) targetedStoreIds.add(sid) })
    }
    const batch = db.batch()
    for (const u of users.docs) {
      const ud = u.data(); const eligible = p.audienceType === 'all_merchants' || (p.audienceType === 'selected_merchants' ? (p.targetMerchantIds || []).includes(u.id) : (ud.storeIds || []).some((sid: string) => targetedStoreIds.has(sid)))
      if (!eligible) continue
      const n = db.collection('notifications').doc(`${promotionId}-${u.id}`)
      batch.set(n, { id: n.id, userId: u.id, merchantId: u.id, title: p.title, body: p.message || '', type: 'platform_promotion', promotionId, read: false, createdAt: now() }, { merge: true })
    }
    await batch.commit()
  }
  return { ok: true }
})

export const getEligiblePromotions = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const storeId = request.data?.storeId
  if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')
  await assertStoreAccess(request, storeId, 'settings:view')
  const grant = await grantForStore(storeId, request.auth.uid)
  const merchantId = request.auth.uid
  const snap = await db.collection('platformPromotions').get()
  const promotions = snap.docs.map((d) => ({ id: d.id, ...d.data(), effectiveStatus: promotionState(d.data()) })).filter((p: any) => p.effectiveStatus === 'active').filter((p: any) => p.audienceType === 'all_merchants' || (p.audienceType === 'selected_merchants' ? (p.targetMerchantIds || []).includes(merchantId) : (p.targetPlanIds || []).includes(grant?.sub?.planId)))
  return { promotions }
})

export const listPlatformPromotions = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request)
  const snap = await db.collection('platformPromotions').orderBy('createdAt', 'desc').get()
  return { promotions: snap.docs.map((d) => ({ id: d.id, ...d.data(), effectiveStatus: promotionState(d.data()) })) }
})

export const getPublicPromotions = onCall(async () => {
  const snap = await db.collection('platformPromotions').get()
  return { promotions: snap.docs.map((d) => { const p: any = d.data(); return { id: d.id, title: p.title, message: p.message, type: p.type, audienceType: p.audienceType, planId: p.planId || null, promotionalPrice: p.promotionalPrice ?? null, startsAt: p.startsAt || null, endsAt: p.endsAt || null, placement: p.placement || [], ctaLabel: p.ctaLabel || '', ctaTarget: p.ctaTarget || '', effectiveStatus: promotionState(p) } }).filter((p: any) => p.effectiveStatus === 'active' && p.audienceType === 'all_merchants' && p.placement.includes('pricing')) }
})

// ─────────────────────────────────────────────────────────────
// CRM — Customer 360, Timeline, Tags, Stages, Follow-ups
// ─────────────────────────────────────────────────────────────

export const updateCustomerCrm = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, customerId, patch } = request.data || {}
  if (!storeId || !customerId || !patch || typeof patch !== 'object') throw new HttpsError('invalid-argument', 'المتجر والعميل والتعديلات مطلوبة')
  await assertStoreAccess(request, storeId, ['customers:edit', 'customers:tags', 'customers:notes', 'crm:manage'])
  const ref = db.doc(`customers/${customerId}`)
  const snap = await ref.get()
  if (!snap.exists || snap.data()?.storeId !== storeId) throw new HttpsError('not-found', 'العميل غير موجود ضمن هذا المتجر')
  const before = snap.data()!
  const updates: Record<string, any> = { updatedAt: now() }
  let timelineType: string | null = null
  let timelineTitle = ''
  let timelineBody = ''

  if ('stage' in patch) {
    const stage = normalizeCrmStage(patch.stage)
    if (patch.stage != null && stage == null) throw new HttpsError('invalid-argument', 'المرحلة غير صالحة')
    updates.stage = stage
    // keep legacy segment in sync for old UI
    if (stage) updates.segment = stage === 'lost' ? 'inactive' : stage === 'lead' ? 'new' : stage
    if (before.stage !== stage) {
      timelineType = 'customer.stage_change'
      timelineTitle = `تغيير المرحلة إلى ${crmStageLabel(stage)}`
      timelineBody = `${before.stage || '—'} → ${stage || '—'}`
    }
  }
  if ('tags' in patch) {
    const tags = sanitizeTags(patch.tags)
    updates.tags = tags
    if (JSON.stringify((before.tags || []).sort()) !== JSON.stringify([...tags].sort())) {
      timelineType = timelineType || 'customer.tag'
      timelineTitle = timelineTitle || 'تحديث الوسوم'
      timelineBody = tags.join('، ') || 'بدون وسوم'
    }
  }
  if ('note' in patch) {
    const note = String(patch.note || '').trim().slice(0, 2000)
    updates.note = note || null
    if (note && note !== before.note) {
      // also push to notes history
      updates.notes = FieldValue.arrayUnion({ body: note, at: Timestamp.now(), by: request.auth.uid })
      timelineType = timelineType || 'customer.note'
      timelineTitle = 'ملاحظة جديدة'
      timelineBody = note.slice(0, 300)
    }
  }
  if ('name' in patch) {
    const name = String(patch.name || '').trim().slice(0, 120)
    if (!name) throw new HttpsError('invalid-argument', 'الاسم مطلوب')
    updates.name = name
  }
  if ('phone' in patch) {
    const phone = String(patch.phone || '').trim()
    const norm = normalizePhoneEG(phone)
    if (!norm) throw new HttpsError('invalid-argument', 'رقم الهاتف غير صالح')
    // dedup check: ensure no other customer owns this normalized phone
    const dup = await db.collection('customers').where('storeId', '==', storeId).where('phoneNormalized', '==', norm).limit(5).get()
    const conflict = dup.docs.find((d) => d.id !== customerId)
    if (conflict) throw new HttpsError('already-exists', 'رقم الهاتف مستخدم لعميل آخر')
    updates.phone = phone
    updates.phoneNormalized = norm
  }
  if ('email' in patch) updates.email = String(patch.email || '').trim().slice(0, 200).toLowerCase() || null
  if ('governorate' in patch) updates.governorate = String(patch.governorate || '').slice(0, 80)
  if ('city' in patch) updates.city = String(patch.city || '').slice(0, 80)
  if ('area' in patch) updates.area = String(patch.area || '').slice(0, 80)
  if ('address' in patch) updates.address = String(patch.address || '').slice(0, 500)

  if (Object.keys(updates).length <= 1) throw new HttpsError('invalid-argument', 'لا توجد حقول للتحديث')

  await ref.update(updates)
  if (timelineType) await logCustomerEvent(storeId, customerId, timelineType, timelineTitle, { body: timelineBody, createdBy: request.auth.uid, meta: { before: before.stage || before.segment, after: updates.stage } }).catch(() => {})
  await auditLog(storeId, request.auth.uid, 'update_customer_crm', 'customers', customerId, { fields: Object.keys(updates) }).catch(() => {})
  return { ok: true }
})

export const addCustomerNote = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, customerId, body } = request.data || {}
  if (!storeId || !customerId || !String(body || '').trim()) throw new HttpsError('invalid-argument', 'المتجر والعميل ونص الملاحظة مطلوبة')
  await assertStoreAccess(request, storeId, ['customers:notes', 'customers:edit', 'crm:manage'])
  const ref = db.doc(`customers/${customerId}`)
  const snap = await ref.get()
  if (!snap.exists || snap.data()?.storeId !== storeId) throw new HttpsError('not-found', 'العميل غير موجود')
  const text = String(body).trim().slice(0, 2000)
  await ref.update({
    note: text,
    notes: FieldValue.arrayUnion({ body: text, at: Timestamp.now(), by: request.auth.uid }),
    updatedAt: now(),
  })
  await logCustomerEvent(storeId, customerId, 'note.added', 'ملاحظة جديدة', { body: text.slice(0, 300), createdBy: request.auth.uid })
  await auditLog(storeId, request.auth.uid, 'add_customer_note', 'customers', customerId, {}).catch(() => {})
  return { ok: true }
})

export const upsertCustomerFollowUp = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, customerId, followUpId, dueAt, notes, assignedTo, status, result } = request.data || {}
  if (!storeId || !customerId || !dueAt) throw new HttpsError('invalid-argument', 'المتجر والعميل وتاريخ المتابعة مطلوبة')
  await assertStoreAccess(request, storeId, ['customers:followups', 'customers:edit', 'crm:followups', 'crm:manage'])
  const custSnap = await db.doc(`customers/${customerId}`).get()
  if (!custSnap.exists || custSnap.data()?.storeId !== storeId) throw new HttpsError('not-found', 'العميل غير موجود')
  const cust = custSnap.data()!
  const dueDate = new Date(dueAt)
  if (isNaN(dueDate.getTime())) throw new HttpsError('invalid-argument', 'تاريخ المتابعة غير صالح')
  const normalizedStatus = ['pending', 'done', 'cancelled', 'overdue'].includes(String(status)) ? String(status) : 'pending'
  // overdue is derived, not directly set except via scheduler; but allow manual
  let assignedName: string | null = null
  if (assignedTo) {
    const uSnap = await db.doc(`users/${assignedTo}`).get().catch(() => null)
    if (uSnap?.exists) assignedName = String(uSnap.data()?.name || uSnap.data()?.email || assignedTo)
  }
  const payload: Record<string, any> = {
    storeId,
    customerId,
    customerName: cust.name || '',
    customerPhone: cust.phone || '',
    dueAt: Timestamp.fromDate(dueDate),
    status: normalizedStatus,
    notes: String(notes || '').slice(0, 2000) || null,
    result: String(result || '').slice(0, 2000) || null,
    assignedTo: assignedTo || null,
    assignedToName: assignedName,
    updatedAt: now(),
  }
  let ref: FirebaseFirestore.DocumentReference
  let isNew = false
  if (followUpId) {
    ref = db.doc(`customerFollowUps/${followUpId}`)
    const existing = await ref.get()
    if (!existing.exists || existing.data()?.storeId !== storeId || existing.data()?.customerId !== customerId) throw new HttpsError('not-found', 'المتابعة غير موجودة')
    await ref.update(payload)
  } else {
    ref = db.collection('customerFollowUps').doc()
    isNew = true
    await ref.set({
      id: ref.id,
      ...payload,
      createdAt: now(),
      createdBy: request.auth.uid,
    })
  }
  // Update denormalized counters on customer
  const pendingSnap = await db.collection('customerFollowUps').where('storeId', '==', storeId).where('customerId', '==', customerId).where('status', '==', 'pending').orderBy('dueAt', 'asc').limit(1).get().catch(() => null)
  const pendingCountSnap = await db.collection('customerFollowUps').where('storeId', '==', storeId).where('customerId', '==', customerId).where('status', '==', 'pending').get().catch(() => null)
  const nextDue = pendingSnap && !pendingSnap.empty ? pendingSnap.docs[0].data()?.dueAt : null
  const pendingCount = pendingCountSnap ? pendingCountSnap.size : 0
  await db.doc(`customers/${customerId}`).update({ pendingFollowUpsCount: pendingCount, nextFollowUpAt: nextDue || null, updatedAt: now() }).catch(() => {})
  await logCustomerEvent(storeId, customerId, isNew ? 'follow_up.created' : (normalizedStatus === 'done' ? 'follow_up.completed' : normalizedStatus === 'cancelled' ? 'follow_up.cancelled' : 'follow_up.created'), isNew ? 'متابعة جديدة' : normalizedStatus === 'done' ? 'إتمام المتابعة' : 'تحديث المتابعة', { body: payload.notes || '', followUpId: ref.id, createdBy: request.auth.uid, meta: { dueAt: dueDate.toISOString(), status: normalizedStatus } }).catch(() => {})
  return { id: ref.id, ok: true }
})

export const listCustomerTimeline = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, customerId, limit } = request.data || {}
  if (!storeId || !customerId) throw new HttpsError('invalid-argument', 'المتجر والعميل مطلوبان')
  await assertStoreAccess(request, storeId, ['customers:view', 'crm:view'])
  const custSnap = await db.doc(`customers/${customerId}`).get()
  if (!custSnap.exists || custSnap.data()?.storeId !== storeId) throw new HttpsError('not-found', 'العميل غير موجود')
  const lim = Math.min(100, Math.max(10, Number(limit || 50)))
  const snap = await db.collection('customerTimeline').where('storeId', '==', storeId).where('customerId', '==', customerId).orderBy('createdAt', 'desc').limit(lim).get()
  return { events: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }
})

export const getCustomer360 = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, customerId } = request.data || {}
  if (!storeId || !customerId) throw new HttpsError('invalid-argument', 'المتجر والعميل مطلوبان')
  await assertStoreAccess(request, storeId, ['customers:view', 'crm:view'])
  const custSnap = await db.doc(`customers/${customerId}`).get()
  if (!custSnap.exists || custSnap.data()?.storeId !== storeId) throw new HttpsError('not-found', 'العميل غير موجود')
  const customer = { id: custSnap.id, ...custSnap.data() }
  // Orders: by customerDocId primary, plus phone fallback
  const byDoc = await db.collection('orders').where('storeId', '==', storeId).where('customerDocId', '==', customerId).orderBy('createdAt', 'desc').limit(100).get().catch(() => null)
  let orders: any[] = byDoc ? byDoc.docs.map((d) => ({ id: d.id, ...d.data() })) : []
  if (orders.length < 100) {
    const phone = String((customer as any).phone || '')
    const norm = (customer as any).phoneNormalized || normalizePhoneEG(phone)
    if (phone || norm) {
      const variants = new Set<string>([phone, norm].filter(Boolean))
      for (const p of variants) {
        const extra = await db.collection('orders').where('storeId', '==', storeId).where('phone', '==', p).limit(50).get().catch(() => null)
        if (extra && !extra.empty) {
          for (const d of extra.docs) {
            const data = { id: d.id, ...d.data() } as any
            if (!orders.find((o) => o.id === data.id)) orders.push(data)
          }
        }
      }
      orders.sort((a, b) => (toMillis(b.createdAt) ?? 0) - (toMillis(a.createdAt) ?? 0))
      orders = orders.slice(0, 100)
    }
  }
  const shipments = orders.length
    ? await Promise.all(orders.slice(0, 20).map(async (o) => {
        if (!o.id) return null
        const s = await db.collection('shipments').where('orderId', '==', o.id).limit(5).get().catch(() => null)
        return s && !s.empty ? s.docs.map((d) => ({ id: d.id, ...d.data() })) : null
      })).then((arr) => arr.filter(Boolean).flat() as any[])
    : []
  const timelineSnap = await db.collection('customerTimeline').where('storeId', '==', storeId).where('customerId', '==', customerId).orderBy('createdAt', 'desc').limit(50).get().catch(() => null)
  const timeline = timelineSnap ? timelineSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : []
  const followUpsSnap = await db.collection('customerFollowUps').where('storeId', '==', storeId).where('customerId', '==', customerId).orderBy('dueAt', 'desc').limit(20).get().catch(() => null)
  const followUps = followUpsSnap ? followUpsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : []
  const metrics: any = calcCustomerMetricsFromOrders(orders)
  // Enrich with attribution from last order
  const last = orders[0]
  if (last) {
    metrics.salesLinkId = last.salesLinkId || null
    metrics.campaignId = last.campaignId || null
  }
  // Also compute addresses distinct
  const addressMap = new Map<string, any>()
  for (const o of orders) {
    const key = `${o.governorate || ''}|${o.city || ''}|${o.address || ''}`
    if (!key.replace(/\|/g, '').trim()) continue
    if (!addressMap.has(key)) addressMap.set(key, { governorate: o.governorate, city: o.city, area: o.area, address: o.address, count: 1 })
    else addressMap.get(key).count++
  }
  return {
    customer,
    metrics,
    orders,
    shipments,
    timeline,
    followUps,
    addresses: [...addressMap.values()].sort((a, b) => b.count - a.count).slice(0, 5),
  }
})

export const getCrmAnalytics = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId } = request.data || {}
  if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')
  await assertStoreAccess(request, storeId, ['customers:view', 'crm:view', 'crm:analytics', 'reports:view'])
  const customersSnap = await db.collection('customers').where('storeId', '==', storeId).get()
  const customers = customersSnap.docs.map((d) => d.data() as any)
  const ordersSnap = await db.collection('orders').where('storeId', '==', storeId).get()
  const orders = ordersSnap.docs.map((d) => d.data() as any)
  const totalCustomers = customers.length
  const nowMs = Date.now()
  const weekAgo = nowMs - 7 * DAY_MS
  const monthAgo = nowMs - 30 * DAY_MS
  const newCustomers = customers.filter((c: any) => {
    const t = toMillis(c.createdAt) ?? 0
    return t >= monthAgo
  }).length
  // Stage breakdown
  const byStage: Record<string, number> = {}
  for (const c of customers) {
    const s = normalizeCrmStage(c.stage) || normalizeCrmStage(c.segment) || 'new'
    byStage[s] = (byStage[s] || 0) + 1
  }
  const vip = byStage['vip'] || 0
  const atRisk = byStage['at_risk'] || 0
  const lost = byStage['lost'] || 0
  const repeatCustomers = customers.filter((c: any) => Number(c.totalOrders || 0) > 1).length
  const delivered = orders.filter((o: any) => o.status === 'DELIVERED')
  const totalRevenue = delivered.reduce((s: number, o: any) => s + Number(o.totalPrice || 0), 0)
  const avgOrderValue = delivered.length > 0 ? totalRevenue / delivered.length : 0
  const customerLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0
  const repeatPurchaseRate = totalCustomers > 0 ? repeatCustomers / totalCustomers : 0
  // Follow-ups due
  const followUpsSnap = await db.collection('customerFollowUps').where('storeId', '==', storeId).where('status', '==', 'pending').get().catch(() => null)
  let followUpsDue = 0
  let overdueFollowUps = 0
  if (followUpsSnap && !followUpsSnap.empty) {
    for (const d of followUpsSnap.docs) {
      const due = toMillis(d.data()?.dueAt) ?? 0
      if (due && due <= nowMs + 24 * 60 * 60 * 1000) followUpsDue++
      if (due && due < nowMs) overdueFollowUps++
    }
  }
  // Top governorates
  const byGov: Record<string, number> = {}
  for (const c of customers) {
    const g = String(c.governorate || 'غير محدد')
    byGov[g] = (byGov[g] || 0) + 1
  }
  const topGovernorates = Object.entries(byGov).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }))
  // Recent customers trend (last 7 days)
  const byDay: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(nowMs - i * DAY_MS)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    byDay[key] = 0
  }
  for (const c of customers) {
    const m = toMillis(c.createdAt)
    if (m == null) continue
    const t = new Date(m)
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    if (key in byDay) byDay[key]++
  }
  return {
    totalCustomers,
    newCustomers,
    repeatCustomers,
    vip,
    atRisk,
    lost,
    byStage,
    totalRevenue,
    avgOrderValue,
    customerLifetimeValue,
    repeatPurchaseRate,
    followUpsDue,
    overdueFollowUps,
    totalFollowUps: followUpsSnap ? followUpsSnap.size : 0,
    topGovernorates,
    byDay,
  }
})

export const listCrmCustomers = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, q, stage, tag, governorate, minOrders, maxOrders, minSpent, limit } = request.data || {}
  if (!storeId) throw new HttpsError('invalid-argument', 'storeId مطلوب')
  await assertStoreAccess(request, storeId, ['customers:view', 'crm:view'])
  let query: FirebaseFirestore.Query = db.collection('customers').where('storeId', '==', storeId)
  if (stage) {
    const norm = normalizeCrmStage(stage)
    if (norm) query = query.where('stage', '==', norm)
  }
  // Firestore cannot do array-contains + other filters efficiently for tags; fetch then filter
  const lim = Math.min(200, Math.max(10, Number(limit || 50)))
  query = query.orderBy('createdAt', 'desc').limit(Math.min(500, lim * 3))
  const snap = await query.get()
  let customers = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
  if (tag) {
    const low = String(tag).toLowerCase()
    customers = customers.filter((c: any) => Array.isArray(c.tags) && c.tags.some((t: string) => String(t).toLowerCase() === low))
  }
  if (governorate) customers = customers.filter((c: any) => c.governorate === governorate)
  if (q) {
    const needle = String(q).toLowerCase()
    customers = customers.filter((c: any) => String(c.name || '').toLowerCase().includes(needle) || String(c.phone || '').includes(needle) || String(c.email || '').toLowerCase().includes(needle))
  }
  if (minOrders != null) customers = customers.filter((c: any) => Number(c.totalOrders || 0) >= Number(minOrders))
  if (maxOrders != null) customers = customers.filter((c: any) => Number(c.totalOrders || 0) <= Number(maxOrders))
  if (minSpent != null) customers = customers.filter((c: any) => Number(c.totalSpent || 0) >= Number(minSpent))
  customers = customers.slice(0, lim)
  return { customers }
})

// Platform CRM V1: CRM-owned metadata is kept separate from subscription and
// merchant source documents. All access is platform-admin-only.
const PLATFORM_CRM_STAGES = ['lead', 'contacted', 'trial', 'onboarding', 'active', 'at_risk', 'renewal_due', 'churned', 'lost'] as const
type PlatformCrmStage = typeof PLATFORM_CRM_STAGES[number]
const platformCrmRef = (merchantId: string) => db.doc(`platformMerchantCrm/${merchantId}`)

export const getPlatformCrmDashboard = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request)
  const [storesSnap, subsSnap, ticketsSnap] = await Promise.all([
    db.collection('stores').get(),
    db.collection('subscriptions').get(),
    db.collection('tickets').where('status', 'in', ['open', 'pending']).get().catch(() => ({ size: 0 } as any)),
  ])
  const subs = subsSnap.docs.map((d) => d.data())
  const nowMs = Date.now()
  const expiring = subs.filter((s) => { const t = s.expiresAt?.toMillis?.() || 0; return t > nowMs && t < nowMs + 30 * 86400000 }).length
  return {
    totalMerchants: storesSnap.size,
    newLeads: 0,
    trials: subs.filter((s) => s.status === 'trialing').length,
    activePaid: subs.filter((s) => s.status === 'active' && Number(s.planPriceMonthly || s.normalPriceSnapshot || 0) > 0).length,
    expiringSoon: expiring,
    expired: subs.filter((s) => s.status === 'expired').length,
    atRisk: 0,
    churned: subs.filter((s) => s.status === 'cancelled').length,
    lifetime: subs.filter((s) => s.billingModel === 'one_time').length,
    nearOrderLimit: 0,
    openTickets: ticketsSnap.size,
    mrr: null,
  }
})

export const listPlatformCrmMerchants = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request)
  const limit = Math.min(50, Math.max(1, Number(request.data?.limit || 25)))
  const storesSnap = await db.collection('stores').orderBy('createdAt', 'desc').limit(limit + 1).get()
  const hasMore = storesSnap.size > limit
  const docs = storesSnap.docs.slice(0, limit)
  const rows = await Promise.all(docs.map(async (doc) => {
    const store = doc.data()
    const owner = store.ownerId ? await db.doc(`users/${store.ownerId}`).get() : null
    const profile = await platformCrmRef(String(store.ownerId || doc.id)).get()
    const sub = store.activeSubscriptionId ? await db.doc(`subscriptions/${store.activeSubscriptionId}`).get() : null
    return { id: store.ownerId || doc.id, storeId: doc.id, storeName: store.name || '', ownerName: owner?.data()?.name || '', email: owner?.data()?.email || '', phone: owner?.data()?.phone || '', published: store.published === true, emailVerified: owner?.data()?.emailVerified === true, plan: sub?.data()?.planName || sub?.data()?.planId || null, subscriptionStatus: sub?.data()?.status || null, stage: profile.exists ? profile.data()?.stage || null : null, tags: profile.exists ? profile.data()?.tags || [] : [], assignedTo: profile.exists ? profile.data()?.assignedTo || null : null }
  }))
  return { merchants: rows, hasMore }
})

export const getPlatformMerchant360 = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request)
  const merchantId = String(request.data?.merchantId || '').trim()
  if (!merchantId) throw new HttpsError('invalid-argument', 'merchantId مطلوب')
  const userSnap = await db.doc(`users/${merchantId}`).get()
  if (!userSnap.exists || userSnap.data()?.role !== 'merchant') throw new HttpsError('not-found', 'التاجر غير موجود')
  const storeId = String(userSnap.data()?.storeIds?.[0] || '')
  const storeSnap = storeId ? await db.doc(`stores/${storeId}`).get() : null
  const [products, orders, tickets, profile] = await Promise.all([
    db.collection('products').where('storeId', '==', storeId).get(),
    db.collection('orders').where('storeId', '==', storeId).get(),
    db.collection('tickets').where('storeId', '==', storeId).get().catch(() => ({ size: 0 } as any)),
    platformCrmRef(merchantId).get(),
  ])
  const orderData = orders.docs.map((d) => d.data())
  return { merchantId, storeId, user: userSnap.data(), store: storeSnap?.data() || null, profile: profile.exists ? profile.data() : {}, productsCount: products.size, totalOrders: orders.size, ordersUsed: orderData.filter((o) => o.status !== 'CANCELLED').length, gmv: orderData.reduce((sum, o) => sum + Number(o.totalPrice || o.total || 0), 0), ticketsCount: tickets.size, openTickets: tickets.docs?.filter((d: any) => ['open', 'pending'].includes(d.data()?.status)).length || 0 }
})

export const updatePlatformMerchantCrm = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request)
  const merchantId = String(request.data?.merchantId || '').trim()
  if (!merchantId) throw new HttpsError('invalid-argument', 'merchantId مطلوب')
  const merchantSnap = await db.doc(`users/${merchantId}`).get()
  if (!merchantSnap.exists || merchantSnap.data()?.role !== 'merchant') throw new HttpsError('not-found', 'التاجر غير موجود')
  const patch: Record<string, any> = { updatedAt: now(), updatedBy: request.auth!.uid }
  if (request.data?.stage !== undefined) { if (!PLATFORM_CRM_STAGES.includes(request.data.stage)) throw new HttpsError('invalid-argument', 'مرحلة غير صالحة'); patch.stage = request.data.stage as PlatformCrmStage }
  if (request.data?.tags !== undefined) patch.tags = Array.isArray(request.data.tags) ? request.data.tags.map((t: unknown) => sanitizeSensitiveText(String(t)).slice(0, 40)).slice(0, 20) : []
  if (request.data?.assignedTo !== undefined) {
    const assignedTo = request.data.assignedTo ? String(request.data.assignedTo) : null
    if (assignedTo) {
      const assignee = await db.doc(`users/${assignedTo}`).get()
      if (!assignee.exists || !['superAdmin', 'platformStaff'].includes(String(assignee.data()?.role || ''))) throw new HttpsError('invalid-argument', 'مسؤول المنصة غير صالح')
    }
    patch.assignedTo = assignedTo
  }
  await platformCrmRef(merchantId).set(patch, { merge: true })
  if (patch.stage) await auditLog(null, request.auth!.uid, 'crm_stage_changed', 'platformMerchantCrm', merchantId, { stage: patch.stage })
  if (patch.tags) await auditLog(null, request.auth!.uid, 'crm_tags_changed', 'platformMerchantCrm', merchantId, { tags: patch.tags })
  if (patch.assignedTo !== undefined) await auditLog(null, request.auth!.uid, 'crm_assignment_changed', 'platformMerchantCrm', merchantId, { assignedTo: patch.assignedTo })
  return { ok: true }
})

export const addPlatformMerchantNote = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request)
  const merchantId = String(request.data?.merchantId || '').trim(); const body = sanitizeSensitiveText(String(request.data?.body || '')).slice(0, 4000)
  if (!merchantId || !body) throw new HttpsError('invalid-argument', 'بيانات الملاحظة غير مكتملة')
  const merchantSnap = await db.doc(`users/${merchantId}`).get()
  if (!merchantSnap.exists || merchantSnap.data()?.role !== 'merchant') throw new HttpsError('not-found', 'التاجر غير موجود')
  const ref = await platformCrmRef(merchantId).collection('notes').add({ body, createdBy: request.auth!.uid, createdAt: now() })
  await auditLog(null, request.auth!.uid, 'crm_note_added', 'platformMerchantCrm', merchantId, { noteId: ref.id })
  return { id: ref.id }
})
export const listPlatformMerchantNotes = onCall(async (request: CallableRequest<any>) => { await assertPlatformAdmin(request); const merchantId = String(request.data?.merchantId || ''); if (!merchantId) throw new HttpsError('invalid-argument', 'merchantId مطلوب'); const snap = await platformCrmRef(merchantId).collection('notes').orderBy('createdAt', 'desc').limit(50).get(); return { notes: snap.docs.map((d) => ({ id: d.id, ...d.data() })) } })
export const upsertPlatformMerchantFollowUp = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request); const merchantId = String(request.data?.merchantId || ''); const id = String(request.data?.id || '').trim(); const merchantSnap = await db.doc(`users/${merchantId}`).get(); if (!merchantSnap.exists || merchantSnap.data()?.role !== 'merchant') throw new HttpsError('not-found', 'التاجر غير موجود'); const assignedTo = request.data?.assignedTo ? String(request.data.assignedTo) : null; if (assignedTo) { const assignee = await db.doc(`users/${assignedTo}`).get(); if (!assignee.exists || !['superAdmin', 'platformStaff'].includes(String(assignee.data()?.role || ''))) throw new HttpsError('invalid-argument', 'مسؤول المنصة غير صالح') }; const payload = { title: sanitizeSensitiveText(String(request.data?.title || '')).slice(0, 200), dueAt: request.data?.dueAt || null, assignedTo, status: request.data?.status === 'done' ? 'done' : 'open', createdBy: request.auth!.uid, createdAt: now(), ...(request.data?.status === 'done' ? { completedAt: now() } : {}) }
  if (!payload.title) throw new HttpsError('invalid-argument', 'عنوان المتابعة مطلوب')
  const ref = id ? platformCrmRef(merchantId).collection('followUps').doc(id) : platformCrmRef(merchantId).collection('followUps').doc(); await ref.set(payload, { merge: true }); await auditLog(null, request.auth!.uid, id ? 'crm_followup_updated' : 'crm_followup_created', 'platformMerchantCrm', merchantId, { followUpId: ref.id }); if (payload.status === 'done') await auditLog(null, request.auth!.uid, 'crm_followup_completed', 'platformMerchantCrm', merchantId, { followUpId: ref.id }); return { id: ref.id }
})
export const listPlatformMerchantFollowUps = onCall(async (request: CallableRequest<any>) => { await assertPlatformAdmin(request); const merchantId = String(request.data?.merchantId || ''); const snap = await platformCrmRef(merchantId).collection('followUps').orderBy('dueAt', 'asc').limit(50).get(); return { followUps: snap.docs.map((d) => ({ id: d.id, ...d.data() })) } })
