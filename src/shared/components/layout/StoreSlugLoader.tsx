import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { useLocation, useSearch } from 'wouter'
import { StoreContext } from '../../contexts/store-context'
import { useAuth } from '../../hooks/useAuth'
import { Loading } from '../ui/Loading'
import { EmptyState } from '../ui/EmptyState'
import { recordStoreLinkVisitCallable, getPublicStoreStatusCallable, getPublicStoreCallable } from '../../services/auth'
import { parseStoreLocation } from '../../utils/store-route'
import { StoreUnavailable } from '../../../store/components/StoreUnavailable'
import type { Store, PublicStoreStatus } from '../../types'
import { visitEventId } from '../../utils/visit-event'

interface Props {
  children?: any
}

export const StoreSlugLoader: FunctionalComponent<Props> = ({ children }) => {
  const [loc] = useLocation()
  const search = useSearch()
  const { slug, ref } = parseStoreLocation(loc + (search ? `?${search}` : ''))
  const { user } = useAuth()
  const previewRequested = new URLSearchParams(search || '').get('preview') === '1'
  const [store, setStore] = useState<Store | null>(null)
  const [previewAuthorized, setPreviewAuthorized] = useState(false)
  const [loading, setLoading] = useState(!!slug)
  const [error, setError] = useState<string | null>(null)
  // Explicit fail-closed initial state: an unavailable local callable must
  // resolve to an unavailable storefront, never an infinite spinner.
  const [pubStatus, setPubStatus] = useState<PublicStoreStatus | null>({ purchasable: false, reason: 'status_unavailable' })
  const [statusLoading, setStatusLoading] = useState(!!slug)

  useEffect(() => {
    if (!slug || !ref || !store?.id) return

    // Persist the referral across the whole shopping session so it survives
    // navigation from store → product → cart → checkout. The value is keyed by
    // store id so a ref used in store A can never attribute a purchase made in
    // store B (cross-tenant attribution).
    sessionStorage.setItem(`mk_sales_ref_${store.id}`, ref)

    recordStoreLinkVisitCallable({ storeId: store.id, code: ref, eventId: visitEventId(`sales_${store.id}_${ref}`) })
      .then(() => {})
      .catch(() => {
        // Never break the storefront because of an analytics call.
      })

  }, [slug, ref, store?.id])

  useEffect(() => {
    if (!slug) {
      setError('No store slug in URL')
      setLoading(false)
      return
    }

    const cacheKey = `mk-public-store:${slug}`
    let cached: { savedAt: number; store: Store } | null = null
    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (raw) cached = JSON.parse(raw) as { savedAt: number; store: Store }
    } catch { /* ignore malformed local cache */ }

    // Reuse the safe public projection during a shopping session so catalog
    // and product deep-links do not repeat the cold callable on every route.
    // The callable still refreshes in the background and remains authoritative.
    const cacheFresh = cached && Date.now() - cached.savedAt < 60_000
    if (cacheFresh && cached?.store) {
      setStore(cached.store)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    setPreviewAuthorized(false)
    if (!cacheFresh) setStore(null)

    let cancelled = false
    getPublicStoreCallable({ slug, preview: previewRequested })
      .then((res) => {
        if (cancelled) return
        const response = res.data as Store & { previewAuthorized?: boolean }
        const { previewAuthorized: authorized, ...nextStore } = response
        setPreviewAuthorized(authorized === true)
        setStore(nextStore)
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), store: nextStore })) } catch { /* ignore storage limits */ }
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('StoreSlugLoader error:', err)
        setStore(null)
        setError(err?.code === 'functions/not-found' ? 'store_not_found' : 'store_unavailable')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [slug, previewRequested])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setStatusLoading(true)
    const statusKey = `mk-public-status:${slug}`
    try {
      const raw = sessionStorage.getItem(statusKey)
      if (raw) {
        const cached = JSON.parse(raw) as { savedAt: number; status: PublicStoreStatus }
        if (Date.now() - cached.savedAt < 60_000) setPubStatus(cached.status)
        else setPubStatus({ purchasable: false, reason: 'status_unavailable' })
      } else setPubStatus({ purchasable: false, reason: 'status_unavailable' })
    } catch { setPubStatus({ purchasable: false, reason: 'status_unavailable' }) }
    getPublicStoreStatusCallable({ slug })
      .then((res) => {
        if (!cancelled) {
          const nextStatus = (res.data as PublicStoreStatus) || { purchasable: false, reason: 'status_unavailable' }
          setPubStatus(nextStatus)
          setStatusLoading(false)
          try { sessionStorage.setItem(statusKey, JSON.stringify({ savedAt: Date.now(), status: nextStatus })) } catch { /* ignore */ }
        }
      })
      .catch(() => {
        // Fail closed: a status-check failure must never make an unpublished
        // or suspended store look purchasable.
        if (!cancelled) {
          setPubStatus({ purchasable: false, reason: 'status_unavailable' })
          setStatusLoading(false)
        }
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

  // The callable verifies identity and tenant membership server-side before it
  // returns this marker. Using that result avoids a client-profile race while
  // keeping an unauthorized preview fail-closed.
  const canPreview = previewRequested && previewAuthorized

  // A store with no active subscription is not purchasable. Data is never
  // deleted — only purchases, publishing and creation are suspended. Owners
  // and admins can still preview the storefront.
  if (!canPreview && statusLoading) return <Loading />

  if (!statusLoading && pubStatus && !pubStatus.purchasable && !canPreview) {
    return <StoreUnavailable storeName={store.name} reason={pubStatus.reason} />
  }

  // Do not render a public commerce surface until the server has answered the
  // publication check. Merchant/admin previews may continue while the check is
  // pending, but public visitors must not see a fail-open storefront.
  const ctx = { store, loading: false, setStoreId: () => {} }

  return <StoreContext.Provider value={ctx}>{children}</StoreContext.Provider>
}
