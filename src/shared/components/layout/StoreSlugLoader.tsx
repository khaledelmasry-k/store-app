import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { useLocation, useSearch } from 'wouter'
import { collection, query, where, onSnapshot, limit as limitQuery, type QuerySnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { StoreContext } from '../../contexts/store-context'
import { useAuth } from '../../hooks/useAuth'
import { Loading } from '../ui/Loading'
import { EmptyState } from '../ui/EmptyState'
import { recordStoreLinkVisitCallable, getPublicStoreStatusCallable } from '../../services/auth'
import { parseStoreLocation } from '../../utils/store-route'
import { StoreUnavailable } from '../../../store/components/StoreUnavailable'
import type { Store, PublicStoreStatus } from '../../types'

interface Props {
  children?: any
}

export const StoreSlugLoader: FunctionalComponent<Props> = ({ children }) => {
  const [loc] = useLocation()
  const search = useSearch()
  const { slug, ref } = parseStoreLocation(loc + (search ? `?${search}` : ''))
  const { user } = useAuth()
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(!!slug)
  const [error, setError] = useState<string | null>(null)
  const [pubStatus, setPubStatus] = useState<PublicStoreStatus | null>(null)

  useEffect(() => {
    if (!slug || !ref || !store?.id) return

    // Persist the referral across the whole shopping session so it survives
    // navigation from store → product → cart → checkout. The value is keyed by
    // store id so a ref used in store A can never attribute a purchase made in
    // store B (cross-tenant attribution).
    sessionStorage.setItem(`mk_sales_ref_${store.id}`, ref)

    // Count the visit once per session per (store, link) — keyed by store so a
    // code used in store A never suppresses counting in store B.
    const countedKey = `mk_ref_counted_${store.id}_${ref}`
    if (sessionStorage.getItem(countedKey)) return

    let cancelled = false
    recordStoreLinkVisitCallable({ storeId: store.id, code: ref })
      .then(() => {
        if (!cancelled) sessionStorage.setItem(countedKey, '1')
      })
      .catch(() => {
        // Never break the storefront because of an analytics call.
      })

    return () => {
      cancelled = true
    }
  }, [slug, ref, store?.id])

  useEffect(() => {
    if (!slug) {
      setError('No store slug in URL')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setStore(null)

    const q = query(collection(db, 'stores'), where('slug', '==', slug), limitQuery(1))

    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot) => {
        if (!snap.empty) {
          const doc = snap.docs[0]
          setStore({ id: doc.id, ...doc.data() } as unknown as Store)
        } else {
          setStore(null)
          setError('store_not_found')
        }
        setLoading(false)
      },
      (err) => {
        console.error('StoreSlugLoader error:', err)
        setError(err.message)
        setLoading(false)
      },
    )

    return () => unsub()
  }, [slug])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setPubStatus(null)
    getPublicStoreStatusCallable({ slug })
      .then((res) => {
        if (!cancelled) setPubStatus((res.data as PublicStoreStatus) || { purchasable: true })
      })
      .catch(() => {
        // Never gate the storefront because of a status-check failure.
        if (!cancelled) setPubStatus({ purchasable: true })
      })
    return () => {
      cancelled = true
    }
  }, [slug, store?.id])

  if (loading) return <Loading />

  if (error === 'store_not_found') {
    return (
      <div className="loading-screen">
        <EmptyState
          title="المتجر غير موجود"
          description="الرابط الذي طلبته غير صالح."
          icon="error"
          action={
            <button className="btn btn-primary" onClick={() => (window.location.href = '/')}>
              العودة للرئيسية
            </button>
          }
        />
      </div>
    )
  }

  if (!store) {
    return (
      <div className="loading-screen">
        <EmptyState
          title="لم يتم العثور على المتجر"
          description="حدث خطأ غير متوقع."
          icon="error"
        />
      </div>
    )
  }

  const canPreview =
    !!user && (user.role === 'superAdmin' || ((user.role === 'merchant' || user.role === 'staff') && (user.storeIds || []).includes(store.id)))

  // A store with no active subscription is not purchasable. Data is never
  // deleted — only purchases, publishing and creation are suspended. Owners
  // and admins can still preview the storefront.
  if (pubStatus && !pubStatus.purchasable && !canPreview) {
    return <StoreUnavailable storeName={store.name} reason={pubStatus.reason} />
  }

  const ctx = { store, loading: false, setStoreId: () => {} }

  return <StoreContext.Provider value={ctx}>{children}</StoreContext.Provider>
}
