import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../hooks/useAuth'
import { StoreContext } from './store-context'
import type { Store } from '../types'

const STORE_KEY = 'mk-current-store'

export const StoreProvider: FunctionalComponent = ({ children }) => {
  const { user } = useAuth()
  const uid = user?.uid || null
  // Scope the persisted selection per user so a store chosen by one account is
  // never inherited by another account on the same browser/device.
  const storeKey = uid ? `${STORE_KEY}-${uid}` : STORE_KEY

  const [storeId, setStoreId] = useState<string | null>(() => {
    if (!uid) return null
    return localStorage.getItem(storeKey)
  })

  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!uid) {
      setStore(null)
      setStoreId(null)
      return
    }
    const key = `${STORE_KEY}-${uid}`
    setStoreId((prev) => prev ?? localStorage.getItem(key))
  }, [uid, storeKey])

  useEffect(() => {
    if (!storeId) {
      setStore(null)
      return
    }
    setLoading(true)
    const unsub = onSnapshot(doc(db, 'stores', storeId), (snap) => {
      if (snap.exists()) {
        setStore({ id: snap.id, ...snap.data() } as unknown as Store)
      } else {
        setStore(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [storeId])

  const setStoreIdHandler = (id: string | null) => {
    if (id) localStorage.setItem(storeKey, id)
    else localStorage.removeItem(storeKey)
    setStoreId(id)
  }

  return (
    <StoreContext.Provider value={{ store, loading, setStoreId: setStoreIdHandler }}>
      {children}
    </StoreContext.Provider>
  )
}