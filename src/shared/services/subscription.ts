import type { Subscription, SubscriptionPlan, SubscriptionPayment, SubscriptionStatus, StorePurchaseRequest } from '../types'
import { usageLevelFor } from '../utils/constants'

// ─────────────────────────────────────────────────────────────
// Central subscription / entitlement service.
// Mirrors the server-side helpers in functions/src/index.ts — keep in sync.
// ─────────────────────────────────────────────────────────────

export type ResolvedStatus = SubscriptionStatus | 'none'

export function tsMs(t?: { seconds?: number; _seconds?: number; toMillis?: () => number } | string | null): number | null {
  if (!t) return null
  const seconds = typeof (t as any).seconds === 'number' ? (t as any).seconds : (t as any)._seconds
  if (typeof seconds === 'number') return seconds * 1000
  if (typeof (t as any).toMillis === 'function') return (t as any).toMillis()
  const parsed = typeof t === 'string' ? Date.parse(t) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

/** Server-computed subscription status from timestamps + explicit state. */
export function resolveSubscriptionStatus(sub?: Pick<Subscription, 'status' | 'trialEndsAt' | 'currentPeriodEnd' | 'expiresAt'> | null, nowMs = Date.now()): ResolvedStatus {
  if (!sub) return 'none'
  if ((sub as any).billingModel === 'one_time' && (sub as any).ownershipType === 'lifetime' && (sub as any).lifetimeAccess === true) return 'active'
  const explicit = sub.status
  if (explicit === 'cancelled' || explicit === 'suspended') return explicit
  if (explicit === 'trialing') {
    const ends = tsMs(sub.trialEndsAt)
    if (ends != null && nowMs >= ends) return 'expired'
    return 'trialing'
  }
  if (explicit === 'active') {
    const ends = tsMs(sub.currentPeriodEnd) ?? tsMs(sub.expiresAt)
    if (ends != null && nowMs >= ends) return 'expired'
    return 'active'
  }
  return explicit || 'pending'
}

export interface PlanEntitlements {
  products: number
  orders: number
  landingPages: number
  salesLinks: number
  staff: number
  storage: number
}

export function planEntitlements(plan?: SubscriptionPlan | null): PlanEntitlements {
  return {
    products: Number(plan?.productLimit || 0),
    orders: Number(plan?.orderLimitPerMonth || 0),
    landingPages: Number(plan?.landingPagesLimit || 0),
    salesLinks: Number(plan?.salesLinksLimit || 0),
    staff: Number(plan?.staffLimit || 0),
    storage: Number(plan?.storageLimit || 0),
  }
}

/** Canonical feature keys gated per-plan (Phase 6 model). */
export const PLAN_FEATURE_KEYS = [
  'quantityPricing',
  'variantInventory',
  'coupons',
  'analytics',
  'whatsappAutomation',
] as const
export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number]

export const PLAN_FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  quantityPricing: 'تسعير بالكمية',
  variantInventory: 'مخزون حسب المقاس/اللون',
  coupons: 'كوبونات خصم',
  analytics: 'تحليلات أساسية',
  whatsappAutomation: 'أتمتة واتساب',
}

/** True when `plan` explicitly grants the feature (structured flag). Falls back
 * to the legacy free-text `features` list so old plans keep working. */
export function canUseFeature(feature: PlanFeatureKey, plan?: SubscriptionPlan | null): boolean {
  if (!plan) return false
  const flag = (plan as any)[feature]
  if (typeof flag === 'boolean') return flag
  // Legacy plans store features as an Arabic label list — match by label too.
  const label = (PLAN_FEATURE_LABELS as any)[feature]
  if (Array.isArray(plan.features)) {
    return plan.features.some((f) => typeof f === 'string' && (f === feature || f === label || f.toLowerCase() === String(label).toLowerCase()))
  }
  return false
}

/** Numeric limit accessor keyed by entitlement name.
 *  Returns the raw plan cap. When a resource is uncapped, returns 0 — callers
 *  that need to distinguish "unlimited" from a real zero cap should pair this
 *  with `isPlanLimitUnlimited` (a numeric zero is ambiguous on its own). */
export function getPlanLimit(key: 'products' | 'orders' | 'landingPages' | 'salesLinks' | 'staff' | 'storage' | 'stores', plan?: SubscriptionPlan | null): number {
  if (!plan) return 0
  switch (key) {
    case 'products':
      return Number(plan.productLimit || 0)
    case 'orders':
      return Number(plan.orderLimitPerMonth || 0)
    case 'landingPages':
      return Number(plan.landingPagesLimit || 0)
    case 'salesLinks':
      return Number(plan.salesLinksLimit || 0)
    case 'staff':
      return Number(plan.staffLimit || 0)
    case 'storage':
      return Number(plan.storageLimit || 0)
    case 'stores':
      return Number(plan.storeLimit || 1)
    default:
      return 0
  }
}

// Whether a plan grants a resource without a numeric ceiling. Mirrors the
// server-side `isResourceUnlimited` (functions/src/index.ts) — keep in sync.
// An explicit boolean always wins; legacy plans (boolean absent) keep the
// historic 0-or-null == unlimited semantics.
export function isPlanLimitUnlimited(
  key: 'products' | 'salesLinks' | 'staff',
  plan?: SubscriptionPlan | null,
): boolean {
  if (!plan) return false
  if (key === 'products') {
    if (plan.unlimitedProducts === true) return true
    if (plan.unlimitedProducts === false) return false
    return Number(plan.productLimit || 0) === 0
  }
  if (key === 'salesLinks') {
    if (plan.unlimitedSalesLinks === true) return true
    if (plan.unlimitedSalesLinks === false) return false
    return Number(plan.salesLinksLimit || 0) === 0
  }
  // staff (future-proofed for an unlimitedStaff flag)
  if (key === 'staff') return false
  return false
}

export function remainingQuota(used: number, limit: number): number | null {
  if (limit <= 0) return null
  return Math.max(0, limit - used)
}

export function isLimitReached(used: number, limit: number): boolean {
  return limit > 0 && used >= limit
}

export interface SubscriptionUsage {
  used: number
  limit: number
  remaining: number | null
  percent: number
  level: ReturnType<typeof usageLevelFor>
}

export interface ResourceUsageMetric {
  used: number
  limit: number
  remaining: number | null
  percent: number
}

export interface MerchantResourceUsage {
  orders: ResourceUsageMetric
  products: ResourceUsageMetric
  team: ResourceUsageMetric
  storage: ResourceUsageMetric
  landingPages: ResourceUsageMetric
  salesLinks: ResourceUsageMetric
}

export function usageFrom(sub?: Subscription | null, plan?: SubscriptionPlan | null): SubscriptionUsage {
  const limit = Number(plan?.orderLimitPerMonth || 0)
  const used = Number(sub?.ordersUsed || 0)
  const hasLimit = limit > 0
  return {
    used,
    limit,
    remaining: hasLimit ? Math.max(0, limit - used) : null,
    percent: hasLimit ? Math.min(100, Math.round((used / limit) * 100)) : 0,
    level: usageLevelFor(hasLimit ? Math.min(100, Math.round((used / limit) * 100)) : 0, hasLimit),
  }
}

/** Price that pays for the NEXT period (first paid month = launch price). */
export function nextPaymentAmount(sub?: Subscription | null): number {
  if (!sub) return 0
  const normal = Number(sub.normalPriceSnapshot || 0)
  if (sub.billingCycle === 'yearly') {
    return Number(sub.yearlyPriceSnapshot || normal)
  }
  // Monthly: the next payment is periodNumber+1. First paid month (1) uses launch.
  const periodNumber = Number(sub.periodNumber || 0)
  const nextPeriod = periodNumber + 1
  const launch = Number(sub.launchPriceSnapshot || normal)
  return nextPeriod <= 1 ? launch : normal
}

export function hasLaunchOffer(sub?: Subscription | null): boolean {
  if (!sub) return false
  return Number(sub.launchPriceSnapshot || 0) < Number(sub.normalPriceSnapshot || 0)
}

/**
 * Arabic trial countdown.
 * "متبقي 2 يوم" / "متبقي 18 ساعة" / "متبقي 4 ساعات"
 */
export function formatTrialRemaining(trialEndsAt?: { seconds: number } | null, nowMs = Date.now()): string | null {
  const ends = tsMs(trialEndsAt)
  if (ends == null) return null
  const diff = ends - nowMs
  if (diff <= 0) return null
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `متبقي ${Math.max(1, mins)} دقيقة`
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  const remainingMinutes = mins % 60
  if (days > 0) {
    const parts = [`${days} يوم`]
    if (remainingHours > 0) parts.push(`${remainingHours} ساعة`)
    if (remainingMinutes > 0) parts.push(`${remainingMinutes} دقيقة`)
    return `متبقي ${parts.join(' و')}`
  }
  return remainingMinutes > 0 ? `متبقي ${hours} ساعة و${remainingMinutes} دقيقة` : `متبقي ${hours} ساعة`
}

export interface MerchantSubscriptionView {
  subscription: Subscription | null
  plan: SubscriptionPlan | null
  paymentRequests: SubscriptionPayment[]
  changeRequests: import('../types').SubscriptionChangeRequest[]
  purchaseRequests: StorePurchaseRequest[]
  status: ResolvedStatus
  usage: SubscriptionUsage
  nextAmount: number
  launchOffer: boolean
  trialRemaining: string | null
  resourceUsage: MerchantResourceUsage | null
}
