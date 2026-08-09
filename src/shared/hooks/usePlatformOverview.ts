import { useCallback, useEffect, useState } from 'preact/hooks'
import { getPlatformOverviewCallable } from '../services/auth'
import type { PlatformMerchantRow, PlatformMetrics } from '../types'

export interface PlatformOverviewResult {
  rows: PlatformMerchantRow[]
  metrics: PlatformMetrics
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const EMPTY_METRICS: PlatformMetrics = {
  totalMerchants: 0,
  activeStores: 0,
  trialing: 0,
  activeSubscriptions: 0,
  expired: 0,
  suspended: 0,
  cancelled: 0,
  pendingPaymentRequests: 0,
  launchActivations: 0,
  nearLimit: 0,
  reachedLimit: 0,
  mrr: 0,
}

export function usePlatformOverview(): PlatformOverviewResult {
  const [rows, setRows] = useState<PlatformMerchantRow[]>([])
  const [metrics, setMetrics] = useState<PlatformMetrics>(EMPTY_METRICS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getPlatformOverviewCallable()
      const data = res.data as { rows?: PlatformMerchantRow[]; metrics?: PlatformMetrics } | null
      setRows(data?.rows || [])
      setMetrics(data?.metrics || EMPTY_METRICS)
    } catch (e: any) {
      setError(e?.message || 'فشل تحميل بيانات المنصة')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { rows, metrics, loading, error, refresh }
}
