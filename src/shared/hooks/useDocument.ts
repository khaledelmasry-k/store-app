import { useEffect, useState } from 'preact/hooks'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useDocument<T>(path: string, id?: string | null): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!!id)

  useEffect(() => {
    if (!id) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = onSnapshot(
      doc(db, path, id),
      (snap) => {
        setData(snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return () => unsub()
  }, [path, id])

  return { data, loading }
}
