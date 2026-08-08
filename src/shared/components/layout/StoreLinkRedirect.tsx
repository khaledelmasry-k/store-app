import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { resolveStoreLinkCallable } from '../../services/auth'
import { storeBaseUrl } from '../../utils/store-url'
import { Loading } from '../ui/Loading'
import { EmptyState } from '../ui/EmptyState'

interface Props {
  code: string
}

export interface ResolvedLink {
  ok: boolean
  storeSlug?: string
  destinationType?: string
  destinationId?: string | null
  title?: string
}

function destinationPath(type?: string, id?: string | null): string {
  switch (type) {
    case 'catalog':
      return '/catalog'
    case 'product':
      return id ? `/product/${id}` : ''
    case 'landing':
      return id ? `/landing/${id}` : ''
    case 'custom':
      return id && id.startsWith('/') ? id : ''
    default:
      return ''
  }
}

/**
 * Public short-link resolver for `/s/:code`. Looks the link up server-side
 * (never exposes link internals) and redirects to the destination storefront
 * URL with `?ref=<code>` so StoreSlugLoader persists the referral and records
 * the visit. Unknown/inactive links show a clear "not found" state.
 */
export const StoreLinkRedirect: FunctionalComponent<Props> = ({ code }) => {
  const [state, setState] = useState<'loading' | 'missing' | 'redirecting'>('loading')

  useEffect(() => {
    let cancelled = false
    resolveStoreLinkCallable({ code })
      .then((res) => {
        if (cancelled) return
        const data = res.data as ResolvedLink
        if (!data?.ok || !data.storeSlug) {
          setState('missing')
          return
        }
        setState('redirecting')
        const base = storeBaseUrl()
        const path = destinationPath(data.destinationType, data.destinationId)
        const qs = encodeURIComponent(code)
        // Landing pages render on the standalone top-level `/landing/:slug` route
        // (the page resolves its own store from landingPage.storeId), while all
        // other destinations live under the storefront shell.
        const url =
          data.destinationType === 'landing' && data.destinationId
            ? `${base}/landing/${encodeURIComponent(data.destinationId)}?ref=${qs}`
            : `${base}/store/${encodeURIComponent(data.storeSlug)}${path}?ref=${qs}`
        // Full page navigation so the storefront loads fresh and the SPA route
        // is treated as a first-class visit.
        window.location.assign(url)
      })
      .catch(() => {
        if (!cancelled) setState('missing')
      })
    return () => {
      cancelled = true
    }
  }, [code])

  if (state === 'loading' || state === 'redirecting') {
    return (
      <div className="loading-screen">
        <Loading />
        {state === 'redirecting' && <p className="muted small mt-1">جارٍ تحويلك إلى المتجر…</p>}
      </div>
    )
  }

  return (
    <div className="loading-screen">
      <EmptyState
        title="رابط غير صالح"
        description="هذا الرابط غير متاح أو تم إيقافه."
        icon="link_off"
        action={
          <button className="btn btn-primary" onClick={() => (window.location.href = '/')}>
            العودة للرئيسية
          </button>
        }
      />
    </div>
  )
}
export default StoreLinkRedirect
