import { useCallback, useEffect, useState } from 'preact/hooks'
import { getPlatformOverviewCallable } from '../services/auth'
import type { PlatformMerchantRow } from '../types'

export interface PlatformOverviewResult {
  rows: PlatformMerchantRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function usePlatformOverview(): PlatformOverviewResult {
  const [rows, setRows] = useState<PlatformMerchantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getPlatformOverviewCallable()
      setRows((res.data as { rows: PlatformMerchantRow[] })?.rows || [])
    } catch (e: any) {
      setError(e?.message || 'فشل تحميل بيانات المنصة')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { rows, loading, error, refresh }
}
