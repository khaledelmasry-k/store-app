import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { slugify } from './format'

// Public store URLs. Each store owns a stable public URL derived from its
// unique slug, served on the shared storefront domain under `/store/<slug>`
// (the actual SPA route — see StoreSlugLoader).
export function storeBaseUrl(): string {
  const configured = import.meta.env.VITE_STORE_BASE_URL as string | undefined
  if (configured) return configured.replace(/\/+$/, '').replace(/\/store$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return 'https://mk-store-app.web.app'
}

/**
 * The public storefront URL for a store, or null when the store has no usable
 * slug. The URL is derived from `slug` — never `ref` — because the storefront
 * resolves stores by slug.
 */
export function storePublicUrl(store: { ref?: string; slug?: string }): string | null {
  const slug = store?.slug?.trim()
  if (!slug) return null
  return `${storeBaseUrl()}/store/${slug}`
}

export function isValidStoreUrl(store: { ref?: string; slug?: string }): boolean {
  const slug = store?.slug?.trim()
  return !!slug && slug !== 'store' && !/[\s]/.test(slug)
}

/**
 * Slugifies a candidate store name/ref. Mirrors the server-side logic used by
 * `registerMerchant` so the merchant preview matches the final stored slug.
 */
export function normalizeSlug(input: string): string {
  return slugify(input) || 'store'
}

/**
 * Returns the first unused slug for the candidate, appending a numeric suffix
 * (`candidate`, `candidate-2`, `candidate-3`, ...) — same scheme as the
 * registerMerchant callable. `excludingStoreId` skips the store's own record so
 * saving unchanged data does not re-append a suffix.
 */
export async function ensureUniqueSlug(candidate: string, excludingStoreId?: string): Promise<string> {
  const base = normalizeSlug(candidate)
  let slug = base
  let attempt = 1
  for (;;) {
    const snap = await getDocs(query(collection(db, 'stores'), where('slug', '==', slug)))
    const takenByOther = snap.docs.some((d) => d.id !== excludingStoreId)
    if (!takenByOther) return slug
    attempt += 1
    slug = `${base}-${attempt}`
  }
}