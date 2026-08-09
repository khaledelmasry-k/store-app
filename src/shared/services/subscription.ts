import type { Subscription, SubscriptionPlan, SubscriptionPayment, SubscriptionStatus } from '../types'
import { usageLevelFor } from '../utils/constants'

// ─────────────────────────────────────────────────────────────
// Central subscription / entitlement service.
// Mirrors the server-side helpers in functions/src/index.ts — keep in sync.
// ─────────────────────────────────────────────────────────────

export type ResolvedStatus = SubscriptionStatus | 'none'

export function tsMs(t?: { seconds?: number } | null): number | null {
  if (!t || typeof t.seconds !== 'number') return null
  return t.seconds * 1000
}

/** Server-computed subscription status from timestamps + explicit state. */
export function resolveSubscriptionStatus(sub?: Pick<Subscription, 'status' | 'trialEndsAt' | 'currentPeriodEnd' | 'expiresAt'> | null, nowMs = Date.now()): ResolvedStatus {
  if (!sub) return 'none'
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

export interface SubscriptionUsage {
  used: number
  limit: number
  remaining: number | null
  percent: number
  level: ReturnType<typeof usageLevelFor>
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
  const periodNumber = Number(sub.periodNumber || 0)
  const normal = Number(sub.normalPriceSnapshot || 0)
  const launch = Number(sub.launchPriceSnapshot || normal)
  return periodNumber <= 0 ? launch : normal
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
  if (hours < 24) return `متبقي ${hours} ساعة`
  const days = Math.floor(hours / 24)
  return `متبقي ${days} يوم`
}

export interface MerchantSubscriptionView {
  subscription: Subscription | null
  plan: SubscriptionPlan | null
  paymentRequests: SubscriptionPayment[]
  status: ResolvedStatus
  usage: SubscriptionUsage
  nextAmount: number
  launchOffer: boolean
  trialRemaining: string | null
}
