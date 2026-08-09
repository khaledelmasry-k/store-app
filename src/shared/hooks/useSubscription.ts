import { useEffect, useState, useCallback } from 'preact/hooks'
import { getMerchantSubscriptionCallable } from '../services/auth'
import {
  resolveSubscriptionStatus,
  usageFrom,
  nextPaymentAmount,
  hasLaunchOffer,
  formatTrialRemaining,
  type MerchantSubscriptionView,
  type ResolvedStatus,
} from '../services/subscription'
import type { Subscription, SubscriptionPlan, SubscriptionPayment } from '../types'

export interface SubscriptionState extends MerchantSubscriptionView {
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Live merchant subscription state for a store. Status is computed client-side
 * for instant countdown display, but the authoritative value always comes from
 * the getMerchantSubscription callable (server-resolved).
 */
export function useSubscription(storeId: string): SubscriptionState {
  const [raw, setRaw] = useState<{
    subscription: Subscription | null
    plan: SubscriptionPlan | null
    paymentRequests: SubscriptionPayment[]
    status: ResolvedStatus
  }>({ subscription: null, plan: null, paymentRequests: [], status: 'none' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(Date.now())

  const refresh = useCallback(async () => {
    if (!storeId) {
      setRaw({ subscription: null, plan: null, paymentRequests: [], status: 'none' })
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await getMerchantSubscriptionCallable({ storeId })
      const data = res.data as { subscription: Subscription | null; plan: SubscriptionPlan | null; paymentRequests: SubscriptionPayment[]; status: ResolvedStatus }
      setRaw({
        subscription: data.subscription ? { ...data.subscription, id: data.subscription.id } : null,
        plan: data.plan ? { ...data.plan, id: data.plan.id } : null,
        paymentRequests: data.paymentRequests || [],
        status: data.status || 'none',
      })
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل الاشتراك')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Recompute countdown/expiry every 60s so the banner stays live.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  const { subscription, plan, paymentRequests, status } = raw
  const resolved = resolveSubscriptionStatus(subscription, tick)

  return {
    subscription,
    plan,
    paymentRequests,
    status: status === 'none' ? 'none' : resolved,
    usage: usageFrom(subscription, plan),
    nextAmount: nextPaymentAmount(subscription),
    launchOffer: hasLaunchOffer(subscription),
    trialRemaining: formatTrialRemaining(subscription?.trialEndsAt, tick),
    loading,
    error,
    refresh,
  }
}
