// Public store URLs. Each store owns a stable public URL derived from its
// unique slug, served on the shared storefront domain.
export function storeBaseUrl(): string {
  return (import.meta.env.VITE_STORE_BASE_URL as string) || 'https://mystore.app'
}

export function storePublicUrl(store: { ref?: string; slug?: string }): string {
  const ref = store?.ref || store?.slug || ''
  return `${storeBaseUrl()}/${ref}`
}
