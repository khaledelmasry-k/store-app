import { useEffect, useState, useRef } from 'preact/hooks'
import { subscribeCollection, type ListParams } from '../utils/firestore'

export interface CollectionResult<T> {
  data: T[]
  loading: boolean
  error: Error | null
}

export function useCollection<T>(path: string, params: ListParams = {}, enabled = true, deps: unknown[] = []): CollectionResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      setData([])
      setLoading(false)
      return
    }

    let cancelled = false
    let unsub: (() => void) | undefined

    setLoading(true)
    setError(null)

    unsub = subscribeCollection<T>(path, params, (items) => {
      if (cancelled) return
      setData(items)
      setLoading(false)
      initializedRef.current = true
    }, (err) => {
      if (cancelled) return
      setError(err)
      setLoading(false)
      initializedRef.current = true
    })

    return () => {
      cancelled = true
      unsub?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, JSON.stringify(params), ...deps])

  if (enabled && !initializedRef.current && data.length === 0 && !error) return { data, loading: true, error: null }
  return { data, loading, error }
}
