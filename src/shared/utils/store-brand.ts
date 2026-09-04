// Merchant store branding helpers — used by the centralized <MerchantLogo/>
// component and the merchant "شعار المتجر" selector. These are TENANT assets
// (belong to each merchant's own store) and have nothing to do with the M&K
// platform brand mark (src/shared/components/brand/BrandMark.tsx).

export const STORE_PRESET_PREFIX = 'preset:'

/** Generic platform-offered store logos the merchant can pick (stored as a key). */
export const STORE_LOGO_PRESETS = [
  { id: 'storefront', name: 'متجر', icon: 'storefront' },
  { id: 'boutique', name: 'بوتيك', icon: 'category' },
  { id: 'deals', name: 'عروض', icon: 'sell' },
  { id: 'star', name: 'نجمة', icon: 'star' },
  { id: 'goods', name: 'بضائع', icon: 'inventory' },
  { id: 'luxe', name: 'فخامة', icon: 'gem' },
] as const

export interface StoreLogoPreset {
  id: string
  name: string
  icon: string
}

export type StoreLogoKind = 'preset' | 'image' | 'none'

/**
 * True when a value is a real image that can be <img>-rendered. Allows the
 * GCS download URLs from Firebase Storage (https) plus legacy inline data:image
 * sources. Never blob:/object: URLs — those die on refresh.
 */
export function isRenderableImageUrl(value: string | undefined | null): boolean {
  if (!value) return false
  if (value.startsWith('data:')) return value.startsWith('data:image/')
  return /^https?:\/\//i.test(value)
}

/**
 * True when a value is safe to PERSIST into Firestore as a store logo. Only
 * real https/http URLs are accepted — blob:, object:, empty and data: URIs are
 * rejected so the stored value survives refresh without depending on local state.
 */
export function isPersistableImageUrl(value: string | undefined | null): boolean {
  if (!value) return false
  return /^https?:\/\//i.test(value) && value.length < 2048
}

export function storeLogoKey(presetId: string): string {
  return `${STORE_PRESET_PREFIX}${presetId}`
}

export function storeLogoKind(logo: string | undefined | null): StoreLogoKind {
  if (!logo) return 'none'
  if (logo.startsWith(STORE_PRESET_PREFIX)) return 'preset'
  if (isRenderableImageUrl(logo)) return 'image'
  return 'none'
}

export function presetFromLogo(logo: string | undefined | null): StoreLogoPreset | null {
  if (storeLogoKind(logo) !== 'preset') return null
  const id = (logo || '').slice(STORE_PRESET_PREFIX.length)
  return STORE_LOGO_PRESETS.find((p) => p.id === id) || null
}