import { useEffect, useState } from 'preact/hooks'
import { subscribeCollection, type ListParams } from '../utils/firestore'
import type { CollectionResult } from './useCollection'

/** Opt-in realtime collection subscription for data that genuinely needs it. */
export function useRealtimeCollection<T>(path: string, params: ListParams = {}, enabled = true, deps: unknown[] = []): CollectionResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled) { setData([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    const unsubscribe = subscribeCollection<T>(path, params, (items) => {
      if (!cancelled) { setData(items); setLoading(false) }
    }, (err) => {
      if (!cancelled) { setError(err); setLoading(false) }
    })
    return () => { cancelled = true; unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, JSON.stringify(params), ...deps])

  return { data, loading, error }
}
