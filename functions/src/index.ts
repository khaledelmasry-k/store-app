import * as admin from 'firebase-admin'
import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore'
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { onObjectFinalized, onObjectDeleted } from 'firebase-functions/v2/storage'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { CANONICAL_PLANS } from './planCatalog'

admin.initializeApp()

// Bucket the app uploads to (matches VITE_FIREBASE_STORAGE_BUCKET). The Storage
// triggers below watch THIS bucket so the `storageUsed` counter stays in sync
// with real merchant uploads. Override via STORAGE_BUCKET when self-hosting.
const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET || `${process.env.GCLOUD_PROJECT || 'mk-store-app'}.firebasestorage.app`

const db = admin.firestore()
const auth = admin.auth()

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const now = () => FieldValue.serverTimestamp()

function tsFromDate(d: Date) {
  return Timestamp.fromDate(d)
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

// Mirrors src/shared/utils/shipping.ts (client). Never trust a client-supplied
// shipping fee — recompute from the stored store config + zones.
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

// Mirrors src/shared/services/subscription.ts (client). Functions is a
// separate package, so status resolution is duplicated here on purpose and
// must stay in sync with the client helper.
function tsMs(t?: { seconds?: number } | null): number | null {
  if (!t || typeof t.seconds !== 'number') return null
  return t.seconds * 1000
}

function resolveSubscriptionStatus(sub: any, nowMs = Date.now()): string {
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
  const snap = await db.collection('subscriptions').where('storeId', '==', storeId).orderBy('createdAt', 'desc').limit(1).get()
  if (snap.empty) return null
  return { id: snap.docs[0].id, data: snap.docs[0].data() }
}

// Lazily persist an expiry flip (deduped) with a notification + audit trail.
// No background jobs on the Spark plan, so expiry is enforced on access.
async function expireSubscriptionLazily(storeId: string, subId: string, sub: any, userId?: string | null) {
  if (sub?.status === 'expired') return
  await db.doc(`subscriptions/${subId}`).update({ status: 'expired', updatedAt: now() })
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
  const entry = await latestSubscriptionForStore(storeId)
  if (!entry) return null
  const status = resolveSubscriptionStatus(entry.data)
  if (status === 'trialing' || status === 'active') {
    const planSnap = await db.doc(`plans/${entry.data.planId}`).get()
    if (!planSnap.exists) return null
    return { sub: entry.data, subId: entry.id, plan: planSnap.data() }
  }
  if (status === 'expired' && entry.data.status !== 'expired') {
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
    abandonedCart: 'استعادة سلة غير مكتملة',
    analytics: 'تحليلات أساسية',
    advancedReports: 'تقارير متقدمة',
    customDomain: 'نطاق مخصص',
    apiAccess: 'واجهة برمجية (API/Webhooks)',
    removeBranding: 'إزالة علامة M&K',
    prioritySupport: 'دعم أولوية',
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
    launchUsed: opts.launchUsed ?? (launchPriceSnapshot < normalPriceSnapshot && periodNumber <= 1),
    trialStartedAt: FieldValue.delete(),
    trialEndsAt: FieldValue.delete(),
    ...(opts.paymentRequestId ? { lastPaymentRequestId: opts.paymentRequestId } : {}),
    updatedAt: now(),
  })

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
export const createOrder = onCall(async (request: CallableRequest<any>) => {
  const { storeId, items, customer, paymentMethod, salesLinkRef, landingPageId } = request.data || {}
  const requestedCouponCode = String(request.data?.couponCode || '').trim().toUpperCase()
  if (!storeId || !Array.isArray(items) || items.length === 0) throw new HttpsError('invalid-argument', 'بيانات الطلب غير مكتملة')
  if (!customer?.name || !customer?.phone) throw new HttpsError('invalid-argument', 'بيانات العميل مطلوبة')

  const allowedPayments = ['cod', 'bank']
  if (paymentMethod && !allowedPayments.includes(paymentMethod)) {
    throw new HttpsError('invalid-argument', 'طريقة دفع غير صالحة')
  }

  // Verify store exists, is active and published (IDOR mitigation — never trust
  // storeId without validation). Unpublished stores reject purchases.
  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) {
    throw new HttpsError('not-found', 'المتجر غير موجود أو غير مفعل')
  }
  if (!storeSnap.data()?.published) {
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

  const storeData = storeSnap.data()!
  const shippingCfg = storeData.shipping
  // Pre-fetch zones for the zones shipping model. All reads must happen before
  // any writes within the transaction, and the subtotal is only known mid-tx,
  // so zones are fetched up-front and matched inside the transaction.
  const zonesSnap = shippingCfg?.enabled && shippingCfg?.model === 'zones'
    ? await db.collection('shipping').where('storeId', '==', storeId).where('active', '==', true).get()
    : null
  const zones = zonesSnap ? zonesSnap.docs.map((d) => ({ ...d.data(), id: d.id })) : []

  // Upsert, never duplicate: reuse an existing customer for the same store when
  // the phone already exists. This keeps one Customer doc per (storeId, phone).
  const existingCustomer = await db.collection('customers')
    .where('storeId', '==', storeId)
    .where('phone', '==', String(customer.phone))
    .limit(1)
    .get()
  const existingCustomerDoc = existingCustomer.empty ? null : existingCustomer.docs[0]
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
      if (costPrice != null) {
        orderCostItems.push({
          lineId,
          productId: item.productId,
          variantId: variantId || null,
          quantity: qty,
          costPrice,
          source: hasVariantCost ? 'variant' : 'product',
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
      if (!coupon.active) throw new HttpsError('failed-precondition', 'كود الخصم غير نشط')
      const expiresAt = coupon.expiresAt
      const expiryMs = expiresAt?.toMillis ? expiresAt.toMillis() : expiresAt?.seconds ? Number(expiresAt.seconds) * 1000 : null
      if (expiryMs && expiryMs <= Date.now()) throw new HttpsError('failed-precondition', 'انتهت صلاحية كود الخصم')
      if (Number(coupon.maxUses || 0) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.maxUses)) {
        throw new HttpsError('failed-precondition', 'اكتمل استخدام كود الخصم')
      }
      if (Number(coupon.minOrder || 0) > subtotal) throw new HttpsError('failed-precondition', 'الطلب لا يحقق الحد الأدنى للكوبون')
      const value = Number(coupon.value || 0)
      discount = coupon.type === 'fixed' ? Math.min(subtotal, value) : Math.min(subtotal, subtotal * Math.min(100, value) / 100)
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

    // Compute shipping server-side from stored config + zones (mirrors the
    // client quote; never trusts a client-supplied fee).
    const shipping = computeShippingFee(shippingCfg, zones, subtotal, customer.governorate || '')
    if (!shipping.available) throw new HttpsError('failed-precondition', shipping.unavailableReason || 'الشحن غير متوفر لهذه الوجهة')
    shippingSnapshot = shipping.snapshot

    // Customer upsert — one Customer doc per (storeId, phone). Reuse the
    // existing doc when present, otherwise create. Never duplicates.
    let customerDocId: string
    if (existingCustomerDoc) {
      customerDocId = existingCustomerDoc.id
      tx.update(db.doc(`customers/${customerDocId}`), {
        name: customer.name,
        phone: customer.phone,
        governorate: customer.governorate || '',
        city: customer.city || '',
        address: customer.address || '',
        note: customer.notes || null,
        ...(customerType === 'registered' ? { type: 'registered', userId: request.auth?.uid || null } : {}),
        totalOrders: FieldValue.increment(1),
        totalSpent: FieldValue.increment(subtotal - discount),
        lastOrderAt: now(),
        updatedAt: now(),
      })
    } else {
      customerDocId = db.collection('customers').doc().id
      tx.set(db.doc(`customers/${customerDocId}`), {
        storeId,
        name: customer.name,
        phone: customer.phone,
        governorate: customer.governorate || '',
        city: customer.city || '',
        address: customer.address || '',
        segment: null,
        note: customer.notes || null,
        type: customerType,
        userId: request.auth?.uid || null,
        totalOrders: FieldValue.increment(1),
        totalSpent: FieldValue.increment(subtotal - discount),
        lastOrderAt: now(),
        createdAt: now(),
        updatedAt: now(),
        createdBy: 'system',
      })
    }

    tx.set(db.doc(`orders/${orderId}`), {
      storeId,
      orderNumber,
      customerName: customer.name,
      phone: customer.phone,
      governorate: customer.governorate || '',
      city: customer.city || '',
      address: customer.address || '',
      notes: customer.notes || null,
      customerId: request.auth?.uid || null,
      customerType,
      customerDocId,
      items: lineItems,
      subtotal,
      shippingFee: shipping.fee,
      shippingMethod: shipping.method,
      shippingSnapshot,
      discount,
      totalPrice: subtotal + shipping.fee - discount,
      status: 'NEW',
      statusHistory: [{ status: 'NEW', at: Timestamp.now(), by: request.auth?.uid || 'guest' }],
      paymentMethod: paymentMethod || 'cod',
      couponCode: requestedCouponCode || null,
      trackingCode: null,
      salesLinkRef: salesLinkRef || null,
      salesLinkId,
      salesLinkStaffId,
      salesLinkSnapshot,
      landingPageId: landingPageSnapshot ? landingPageId : null,
      landingPageSnapshot,
      createdAt: now(),
      updatedAt: now(),
      createdBy: request.auth?.uid || 'guest',
    })

    tx.set(db.doc(`orderCosts/${orderId}`), {
      id: orderId,
      orderId,
      storeId,
      items: orderCostItems,
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
   if (productLimit !== null) {
     const existingProducts = await db.collection('products').where('storeId', '==', storeId).get()
     if (existingProducts.size >= productLimit) {
       throw new HttpsError('resource-exhausted', `تم تجاوز حد المنتجات (${productLimit})`)
     }
   }

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

  const existing = await db.doc(`products/${productId}`).get()
  if (existing.exists) throw new HttpsError('already-exists', 'يوجد منتج بهذا المعرّف')

  await db.doc(`products/${productId}`).set({
    ...data,
    id: productId,
    storeId,
    createdAt: now(),
    updatedAt: now(),
    createdBy: request.auth?.uid || 'guest',
  })

  await auditLog(storeId, request.auth?.uid || 'guest', 'create_product', 'products', productId, { name: data.name })

  return { id: productId, name: data.name }
})

// ─────────────────────────────────────────────────────────────
// 4. registerMerchant — atomic tenant + store + owner creation.
//     Self-serve: the merchant picks a plan and a 3-day TRIAL starts
//     immediately — no platform approval required at signup.
// ─────────────────────────────────────────────────────────────
export const registerMerchant = onCall(async (request: CallableRequest<any>) => {
  const { email, password, name, phone, storeName, storeRef, planId, billingCycle } = request.data || {}
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

  // Resolve the plan: explicit planId → settings.defaultPlanId → first active plan.
  let resolvedPlanId = planId && planId !== 'pending' ? String(planId) : ''
  let planSnap: admin.firestore.DocumentSnapshot | admin.firestore.QueryDocumentSnapshot | null = null
  if (resolvedPlanId) {
    planSnap = await db.doc(`plans/${resolvedPlanId}`).get()
    if (!planSnap.exists || !planSnap.data()?.active) planSnap = null
  }
  if (!planSnap) {
    const settingsSnap = await db.doc('settings/platform').get().catch(() => null)
    const defaultPlanId = settingsSnap?.exists ? settingsSnap.data()?.defaultPlanId : ''
    if (defaultPlanId) {
      planSnap = await db.doc(`plans/${defaultPlanId}`).get()
      if (!planSnap.exists || !planSnap.data()?.active) planSnap = null
    }
  }
  if (!planSnap) {
    const activePlanQuery = await db.collection('plans').where('active', '==', true).limit(1).get()
    if (activePlanQuery.empty) throw new HttpsError('failed-precondition', 'لا توجد باقات متاحة حالياً')
    planSnap = activePlanQuery.docs[0]
  }
  const plan = planSnap.data() as any
  resolvedPlanId = planSnap.id
  const planName = plan?.name || resolvedPlanId

  // Free plan (price 0) skips the trial entirely: the subscription starts
  // ACTIVE so the tenant/limits work forever without payment/approval. Paid
  // plans keep the 3-day self-serve TRIAL window.
  const isFreePlan = Number(plan?.priceMonthly || 0) <= 0
  const trialDays = Number(plan?.trialDays ?? 3)
  const trialStarted = new Date()
  const trialEnds = new Date(trialStarted.getTime() + trialDays * DAY_MS)
  const normalPriceSnapshot = Number(plan?.priceMonthly || 0)
  const launchEnabled = !!plan?.launchEnabled
  const launchPriceSnapshot = launchEnabled && Number(plan?.launchPrice) > 0 ? Number(plan.launchPrice) : normalPriceSnapshot
  const yearlyPriceSnapshot = Number(plan?.priceYearly || 0)
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly'
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
    createdAt: now(),
    updatedAt: now(),
    createdBy: uid,
  })
  await db.doc(`stores/${storeId}`).set({
    ref: slug,
    name: storeName,
    slug,
    active: true,
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
    status: isFreePlan ? 'active' : 'trialing',
    billingCycle: cycle,
    requestNote: isFreePlan ? 'باقة مجانية' : 'تجربة مجانية',
    trialStartedAt: tsFromDate(trialStarted),
    trialEndsAt: tsFromDate(trialEnds),
    trialDays: isFreePlan ? 0 : trialDays,
    periodNumber: 0,
    normalPriceSnapshot,
    launchPriceSnapshot,
    yearlyPriceSnapshot,
    ordersUsed: 0,
    createdAt: now(),
    updatedAt: now(),
    createdBy: uid,
  }
  if (isFreePlan) {
    delete subDoc.trialStartedAt
    delete subDoc.trialEndsAt
    // No paying period window — status 'active' with no expiry reads as active
    // forever in resolveSubscriptionStatus.
  }
  await db.collection('subscriptions').add(subDoc)

  await auth.createUser({ uid, email: normalizedEmail, password, displayName: name, disabled: false })

  await createBillingNotification(storeId, uid, isFreePlan ? 'بدأت باقتك المجانية' : 'بدأت تجربتك المجانية', isFreePlan ? `باقتك «${planName}» مفعّلة الآن بكامل حدودها. رقِّ باقتك متى احتجت مزايا أكثر.` : `مرحباً ${name}! تجربتك المجانية لمدة ${trialDays} أيام بدأت الآن بباقة ${planName} — بكامل المزايا.`)
  await auditLog(storeId, uid, 'trial_started', 'subscriptions', storeId, { planId: resolvedPlanId, trialDays })

  return { uid, storeId, status: 'trial_started' }
})

// ─────────────────────────────────────────────────────────────
// 4. approveSubscription — platform admin creates merchant login
// ─────────────────────────────────────────────────────────────
export const approveSubscription = onCall(async (request: CallableRequest<{ subscriptionId?: string }>) => {
  await assertPlatformAdmin(request)
  const { subscriptionId } = request.data || {}
  if (!subscriptionId) throw new HttpsError('invalid-argument', 'subscriptionId مطلوب')

  const subRef = db.doc(`subscriptions/${subscriptionId}`)
  const subSnap = await subRef.get()
  if (!subSnap.exists) throw new HttpsError('not-found', 'الاشتراك غير موجود')
  const sub = subSnap.data()!

  const { store, user, periodNumber } = await activateSubscription(subscriptionId, sub, request.auth!.uid)

  await createBillingNotification(sub.storeId, store.ownerId, 'تم تفعيل اشتراكك', `مرحباً ${user?.name || user?.email || 'بك'}. اشتراكك أصبح نشطاً. يمكنك تسجيل الدخول إلى لوحة التحكم.`)
  await auditLog(sub.storeId, request.auth!.uid, 'approve_subscription', 'subscriptions', subscriptionId, { storeId: sub.storeId, ownerId: store.ownerId, periodNumber })

  return { ok: true }
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
  if (!entry) return { subscription: null, plan: null, paymentRequests: [], status: 'none' }

  let status = resolveSubscriptionStatus(entry.data)
  if (status === 'expired' && entry.data.status !== 'expired') {
    await expireSubscriptionLazily(storeId, entry.id, entry.data, request.auth.uid).catch(() => {})
    status = 'expired'
  }

  let plan: any = null
  try {
    const planSnap = await db.doc(`plans/${entry.data.planId}`).get()
    plan = planSnap.exists ? { id: planSnap.id, ...planSnap.data() } : null
  } catch {
    plan = null
  }

  const paySnap = await db.collection('subscriptionPayments')
    .where('subscriptionId', '==', entry.id)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get()
  const paymentRequests = paySnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const storeSnap = await db.doc(`stores/${storeId}`).get().catch(() => null)
  const store = storeSnap?.exists ? storeSnap.data()! : null

  return { subscription: { id: entry.id, ...entry.data }, plan, paymentRequests, status, store: store ? { id: storeId, storageUsed: Number(store.storageUsed || 0), storageLimitBytes: Number(store.storageLimitBytes || 0) } : null }
})

// ─────────────────────────────────────────────────────────────
// 4d2+. changeSubscriptionPlan — merchant upgrades/downgrades their plan.
//      Limits come from the plan doc read live, so flipping the granting
//      subscription's planId immediately applies the new product/order/feature
//      gates (upgrades reset the period counters right away; downgrades keep
//      the current window but enforce the tighter limits). The change is
//      audited + broadcast; the manual-payment flow already gates activations.
// ─────────────────────────────────────────────────────────────
export const changeSubscriptionPlan = onCall(async (request: CallableRequest<{ storeId?: string; planId?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { storeId, planId } = request.data || {}
  if (!storeId || !planId) throw new HttpsError('invalid-argument', 'storeId و planId مطلوبان')
  await assertStoreAccess(request, storeId, 'billing:edit')

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) throw new HttpsError('not-found', 'المتجر غير موجود')

  const planSnap = await db.doc(`plans/${planId}`).get()
  if (!planSnap.exists || !planSnap.data()?.active) throw new HttpsError('not-found', 'الباقة المطلوبة غير متاحة')

  const grant = await grantForStore(storeId, request.auth.uid)
  if (!grant) throw new HttpsError('failed-precondition', 'لا يوجد اشتراك نشط — فعّل باقتك أولاً.')
  if (grant.sub.planId === planId) return { ok: true, changed: false, planId }

  const newPlan = planSnap.data() as any
  const oldPlanName = grant.plan?.name || grant.sub.planId
  // Upgrades reset the period counters right away so the new quota applies fresh;
  // downgrades keep the current window but start enforcing the tighter limits.
  const isUpgrade = Number(newPlan?.priceMonthly || 0) > Number(grant.plan?.priceMonthly || 0)
  const historyEntry = [
    {
      from: grant.sub.planId,
      to: planId,
      by: request.auth.uid,
      at: Timestamp.now(),
    },
  ] as any[]

  await db.doc(`subscriptions/${grant.subId}`).update({
    planId,
    planName: newPlan?.name || planId,
    planChangedAt: now(),
    planChangeFrom: grant.sub.planId,
    planChangeBy: request.auth.uid,
    planChangeHistory: FieldValue.arrayUnion(...historyEntry),
    ...(isUpgrade ? { ordersUsed: 0 } : {}),
    updatedAt: now(),
  })

  // Keep the store's cached storage quota in sync so the Storage triggers
  // (which compare against `storageLimitBytes`) enforce the new plan limit
  // immediately after an upgrade/downgrade.
  const MB = 1024 * 1024
  await db.doc(`stores/${storeId}`).update({
    storageLimitBytes: Number(newPlan?.storageLimit || 0) * MB,
    updatedAt: now(),
  }).catch(() => {})

  const storeSnapForSnap = await db.doc(`stores/${storeId}`).get().catch(() => null)
  const currency = storeSnapForSnap?.exists ? storeSnapForSnap.data()?.currency : 'SAR'
  await recordBillingSnapshot(storeId, {
    type: 'plan_change',
    planId,
    planName: newPlan?.name || planId,
    priceMonthly: Number(newPlan?.priceMonthly || 0),
    priceYearly: Number(newPlan?.priceYearly || 0),
    orderLimitPerMonth: Number(newPlan?.orderLimitPerMonth || 0),
    productLimit: Number(newPlan?.productLimit || 0),
    storageLimitMB: Number(newPlan?.storageLimit || 0),
    currency: currency || 'SAR',
    by: request.auth.uid,
    note: `تغيير الباقة من «${oldPlanName}» إلى «${newPlan?.name || planId}»`,
  })

  await createBillingNotification(
    storeId,
    request.auth.uid,
    'تم تغيير باقتك',
    `تم تحديث باقتك من «${oldPlanName}» إلى «${newPlan?.name || planId}»`,
  )
  await auditLog(storeId, request.auth.uid, 'plan_changed', 'subscriptions', grant.subId, { from: grant.sub.planId, to: planId })

  return { ok: true, changed: true, planId, from: grant.sub.planId, to: planId }
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

// ─────────────────────────────────────────────────────────────
// 4e. submitPaymentRequest — merchant submits a manual payment/activation
//     request. The amount is computed server-side from price snapshots:
//     first paid month = launch price, renewals = normal price. Never trust
//     a client-supplied amount or plan.
// ─────────────────────────────────────────────────────────────
export const submitPaymentRequest = onCall(async (request: CallableRequest<{ subscriptionId?: string; paymentMethod?: string; reference?: string; note?: string; screenshotUrl?: string }>) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول')
  const { subscriptionId, paymentMethod, reference, note, screenshotUrl } = request.data || {}
  if (!subscriptionId || !paymentMethod || !reference) throw new HttpsError('invalid-argument', 'بيانات الدفع غير مكتملة')
  if (!/^[0-9]{6,24}$/.test(String(reference).trim())) throw new HttpsError('invalid-argument', 'رقم العملية غير صالح')

  const subSnap = await db.doc(`subscriptions/${subscriptionId}`).get()
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
  // Monthly billing: first paid month uses the launch price, renewals use normal.
  // Yearly billing: always charges the yearly snapshot (no prorated first-year
  // launch — the plan's yearly price is authoritative). Never trust client price.
  const amount = isYearly
    ? yearlyPriceSnapshot || normalPriceSnapshot
    : periodNumber <= 1
      ? launchPriceSnapshot
      : normalPriceSnapshot
  if (amount <= 0) throw new HttpsError('failed-precondition', 'تعذر تحديد مبلغ الاشتراك')

  const payRef = db.collection('subscriptionPayments').doc()
  await payRef.set({
    id: payRef.id,
    subscriptionId,
    storeId: sub.storeId,
    planId: sub.planId,
    planName: sub.planName || sub.planId,
    amount,
    paymentMethod: String(paymentMethod),
    reference: String(reference).trim(),
    note: note || '',
    screenshotUrl: screenshotUrl || null,
    status: 'pending',
    periodNumber,
    createdAt: now(),
    updatedAt: now(),
    createdBy: request.auth.uid,
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
  const paySnap = await payRef.get()
  if (!paySnap.exists) throw new HttpsError('not-found', 'طلب الدفع غير موجود')
  const pay = paySnap.data()!
  if (pay.status === 'approved') return { ok: true }

  const subSnap = await db.doc(`subscriptions/${pay.subscriptionId}`).get()
  if (!subSnap.exists) throw new HttpsError('not-found', 'الاشتراك غير موجود')
  const sub = subSnap.data()!

  await payRef.update({ status: 'approved', reviewedBy: request.auth!.uid, reviewedAt: now(), reviewNote: note || pay.reviewNote || null, updatedAt: now() })

  const launchUsed = pay.periodNumber <= 1 && Number(sub.launchPriceSnapshot || 0) < Number(sub.normalPriceSnapshot || 0)
  const { store } = await activateSubscription(pay.subscriptionId, sub, request.auth!.uid, {
    periodNumber: pay.periodNumber,
    reference: pay.reference,
    launchUsed,
    paymentRequestId: pay.id,
  })

  await db.collection('transactions').add({
    storeId: pay.storeId,
    type: 'subscription',
    amount: pay.amount,
    status: 'completed',
    description: `تفعيل الباقة ${pay.planName || ''} — الدورة ${pay.periodNumber}`,
    reference: pay.reference,
    subscriptionId: pay.subscriptionId,
    createdAt: now(),
    updatedAt: now(),
    createdBy: request.auth!.uid,
  })

  await createBillingNotification(pay.storeId, store.ownerId, 'تم تفعيل اشتراكك', `اشتراك ${pay.planName || ''} أصبح نشطاً. شكراً لثقتك — استمتع بالباقة!`)
  await auditLog(pay.storeId, request.auth!.uid, 'payment_approved', 'subscriptionPayments', pay.id, { amount: pay.amount, periodNumber: pay.periodNumber })

  return { ok: true }
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

  await payRef.update({ status: 'rejected', reviewedBy: request.auth!.uid, reviewedAt: now(), reviewNote: reason || pay.reviewNote || null, updatedAt: now() })

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
  if (!store.published) return { purchasable: false, reason: 'unpublished' }

  const entry = await latestSubscriptionForStore(storeId)
  if (!entry) return { purchasable: false, reason: 'no_subscription' }
  const status = resolveSubscriptionStatus(entry.data)
  if (status === 'expired' && entry.data.status !== 'expired') {
    await expireSubscriptionLazily(storeId, entry.id, entry.data).catch(() => {})
  }
  const purchasable = status === 'trialing' || status === 'active'
  return { purchasable, reason: purchasable ? 'ok' : 'subscription_required' }
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
  await assertStoreAccess(request, storeId)

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists) throw new HttpsError('not-found', 'المتجر غير موجود')

  if (published) {
    const grant = await grantForStore(storeId, request.auth.uid)
    if (!grant) throw new HttpsError('failed-precondition', 'لا يمكن نشر المتجر — الاشتراك غير نشط. فعّل باقتك أولاً.')
  }

  await db.doc(`stores/${storeId}`).update({ published, updatedAt: now() })
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
  if (limit > 0) {
    const count = await db.collection('landingPages').where('storeId', '==', storeId).get()
    if (count.size >= limit) throw new HttpsError('resource-exhausted', `تم تجاوز حد صفحات الهبوط (${limit})`)
  }

  // Landing pages share the global `/landing/:slug` route, so the slug must be
  // unique across ALL stores — not just this one.
  const slugQuery = await db.collection('landingPages').where('slug', '==', data.slug).limit(1).get()
  if (!slugQuery.empty) throw new HttpsError('already-exists', 'رابط الصفحة (slug) مستخدم مسبقاً — اختر رابطاً آخر')

  const ref = await db.collection('landingPages').add({
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

  await auditLog(storeId, request.auth?.uid || 'guest', 'create_landing_page', 'landingPages', ref.id, { title: data.title })
  return { id: ref.id }
})

export const createSalesLink = onCall(async (request: CallableRequest<any>) => {
  await assertStoreAccess(request, request.data?.storeId, 'sales_links:create')
  const { storeId, data } = request.data || {}
  if (!storeId || !data || !data.code) throw new HttpsError('invalid-argument', 'بيانات رابط البيع غير مكتملة')

   const grant = await grantForStore(storeId, request.auth?.uid)
   if (!grant) throw new HttpsError('failed-precondition', 'الاشتراك غير نشط — لا يمكن إنشاء روابط بيع الآن')

   const salesLinksLimit = resolvedLimit(grant.plan, 'salesLinksLimit', 'unlimitedSalesLinks')
   if (salesLinksLimit !== null) {
     const count = await db.collection('storeLinks').where('storeId', '==', storeId).where('archived', '==', false).get()
     if (count.size >= salesLinksLimit) throw new HttpsError('resource-exhausted', `تم تجاوز حد روابط البيع (${salesLinksLimit})`)
   }

  const linkQuery = await db.collection('storeLinks').where('storeId', '==', storeId).where('code', '==', data.code).limit(1).get()
  if (!linkQuery.empty) throw new HttpsError('already-exists', 'كود الرابط مستخدم مسبقاً')

  const ref = await db.collection('storeLinks').add({
    storeId,
    code: data.code,
    name: data.name || data.code,
    title: data.title || data.name || data.code,
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

  await auditLog(storeId, request.auth?.uid || 'guest', 'create_sales_link', 'storeLinks', ref.id, { code: data.code })
  return { id: ref.id }
})

// ─────────────────────────────────────────────────────────────
// 4k. savePlan — platform admin creates/updates/deactivates a plan. Writes go
//     through a callable so plan changes are audited and plans attached to
//     active subscriptions are never hard-deleted (deactivate instead).
// ─────────────────────────────────────────────────────────────
export const savePlan = onCall(async (request: CallableRequest<any>) => {
  await assertPlatformAdmin(request)
  const { planId, plan } = request.data || {}
  if (!plan || !plan.name || !(Number(plan.priceMonthly) >= 0)) throw new HttpsError('invalid-argument', 'بيانات الباقة غير مكتملة')

  const payload: Record<string, any> = {
    name: String(plan.name),
    description: plan.description || '',
    priceMonthly: Number(plan.priceMonthly),
    priceYearly: Number(plan.priceYearly || 0),
    trialDays: Number(plan.trialDays || 3),
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
    abandonedCart: !!plan.abandonedCart,
    analytics: plan.analytics !== undefined ? !!plan.analytics : true,
    advancedReports: !!plan.advancedReports,
    customDomain: !!plan.customDomain,
    apiAccess: !!plan.apiAccess,
    removeBranding: !!plan.removeBranding,
    prioritySupport: !!plan.prioritySupport,
     storeLimit: Number(plan.storeLimit || 1),
     unlimitedProducts: plan.unlimitedProducts === true,
     unlimitedSalesLinks: plan.unlimitedSalesLinks === true,
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

  let action: string
  let savedId = planId
  if (planId) {
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
  for (const plan of CANONICAL_PLANS) {
    const ref = db.doc(`plans/${plan.id}`)
    batch.set(ref, {
      ...plan,
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
  if (coupon.code != null) changes.code = String(coupon.code).trim().toUpperCase()
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
  if (!storeSnap.exists || !storeSnap.data()?.active || !storeSnap.data()?.published) {
    throw new HttpsError('failed-precondition', 'المتجر لا يقبل الطلبات حاليًا')
  }
  const snap = await db.collection('coupons')
    .where('storeId', '==', storeId)
    .where('code', '==', normalized)
    .limit(1)
    .get()
  if (snap.empty) throw new HttpsError('failed-precondition', 'كود الخصم غير صالح')
  const coupon = snap.docs[0].data()
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

const TENANT_COLLECTIONS = [
  'subscriptions',
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

  // Keep only the latest subscription per store (by createdAt).
  const latestSub = new Map<string, { id: string; data: any }>()
  for (const d of subsSnap.docs) {
    const s = d.data()
    const existing = latestSub.get(s.storeId)
    if (!existing || (s.createdAt?.seconds || 0) >= (existing.data.createdAt?.seconds || 0)) {
      latestSub.set(s.storeId, { id: d.id, data: s })
    }
  }

  // Payment requests for the "pending payment" + payments metrics.
  const paySnap = await db.collection('subscriptionPayments').get()
  const pendingPayments = paySnap.docs.filter((d) => d.data()?.status === 'pending').map((d) => ({ id: d.id, ...d.data() }))

  const rows = storesSnap.docs.map((d) => {
    const store = d.data()
    const storeId = d.id
    const subEntry = latestSub.get(storeId)
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
      active: !!store.active,
      published: !!store.published,
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

  // Durable idempotency for stock restoration: a cancelled/returned order must
  // restore exactly once, no matter which path crosses into a cancelled state.
  // We key the guard on the persisted `stockRestored` flag (not on the *previous*
  // status), so sequences like NEW -> CANCELLED -> DELIVERED -> CANCELLED, or
  // NEW -> CANCELLED -> CANCELLED, restore only on the first cancellation and
  // never again. The flag is written inside the same transaction that restores.
  const becomesCancelled = ['CANCELLED', 'RETURNED'].includes(status)

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

  await auditLog(order.storeId, request.auth.uid, 'update_order_status', 'orders', orderId, { from: order.status, to: status })

  return { ok: true }
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

  const orders = snap.docs.map((d) => {
    const o = d.data()
    return {
      id: d.id,
      orderNumber: o.orderNumber,
      status: o.status,
      statusHistory: Array.isArray(o.statusHistory) ? o.statusHistory : null,
      items: Array.isArray(o.items) ? o.items.map((i: any) => ({ name: i.name, quantity: i.quantity, color: i.color || '', size: i.size || '' })) : [],
      subtotal: o.subtotal || 0,
      shippingFee: o.shippingFee || 0,
      totalPrice: o.totalPrice || 0,
      paymentMethod: o.paymentMethod || 'cod',
      customerType: o.customerType || 'guest',
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }
  })

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

  const storeSnap = await db.doc(`stores/${storeId}`).get()
  if (!storeSnap.exists || !storeSnap.data()?.active) {
    throw new HttpsError('not-found', 'المتجر غير موجود')
  }

  const linkQuery = await db
    .collection('storeLinks')
    .where('storeId', '==', storeId)
    .where('code', '==', String(code))
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

  const linkQuery = await db
    .collection('storeLinks')
    .where('code', '==', String(code))
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
  if (staffLimit > 0) {
    const teamCount = await db.collection('team').where('storeId', '==', storeId).where('active', '==', true).get()
    if (teamCount.size >= staffLimit) {
      throw new HttpsError('resource-exhausted', `تم تجاوز حد أعضاء الفريق (${staffLimit})`)
    }
  }

  // No account may already exist with this email.
  const existing = await db.collection('users').where('email', '==', String(email).toLowerCase()).get()
  if (!existing.empty) {
    throw new HttpsError('already-exists', 'هذا البريد مستخدم مسبقاً')
  }

  const uid = db.collection('users').doc().id
  const initialPassword = Math.random().toString(36).slice(2, 10)

  try {
    await auth.createUser({ uid, email, password: initialPassword, displayName: name, disabled: false })
  } catch (err: any) {
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
    token: Math.random().toString(36).slice(2, 12),
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
      const plan = planSnap.data()!
      const store = storeSnap.exists ? storeSnap.data()! : {}

      // { key, label, used, limit } — limit null means unlimited (skipped).
      const orderLimit = Number(plan.orderLimitPerMonth || 0) > 0 ? Number(plan.orderLimitPerMonth || 0) : null
      const checks: { key: string; label: string; used: number; limit: number | null }[] = []
      checks.push({ key: 'orders', label: 'الطلبات', used: Number(sub.ordersUsed || 0), limit: orderLimit })
      const pLimit = resolvedLimit(plan, 'productLimit', 'unlimitedProducts')
      const sLimit = resolvedLimit(plan, 'salesLinksLimit', 'unlimitedSalesLinks')
      const productsCount = pLimit !== null ? await countWhere(storeId, 'products') : 0
      const linksCount = sLimit !== null ? await countWhere(storeId, 'storeLinks') : 0
      const staffCount = await countWhere(storeId, 'team')
      // Free uses staffLimit 0 to mean "owner only"; treat 0 as uncapped for warnings
      // (the inviteStaff gate already blocks >0 staff on Free).
      const staffLimit = Number(plan.staffLimit || 0) > 0 ? Number(plan.staffLimit || 0) : null
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
