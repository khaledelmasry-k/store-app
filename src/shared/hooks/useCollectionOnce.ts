import { useEffect, useState } from 'preact/hooks'
import { listDocs, type ListParams } from '../utils/firestore'
import type { CollectionResult } from './useCollection'

/** One-time collection read for static/historical dashboard data. */
export function useCollectionOnce<T>(path: string, params: ListParams = {}, enabled = true, deps: unknown[] = []): CollectionResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<Error | null>(null)
  useEffect(() => {
    if (!enabled) { setData([]); setLoading(false); return }
    let cancelled = false
    setLoading(true); setError(null)
    listDocs<T>(path, params).then((items) => { if (!cancelled) { setData(items); setLoading(false) } }).catch((err) => { if (!cancelled) { setError(err instanceof Error ? err : new Error(String(err))); setLoading(false) } })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, JSON.stringify(params), ...deps])
  return { data, loading, error }
}
