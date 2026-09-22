/**
 * Storefront event tracking via the standard GA4/GTM `dataLayer` schema.
 * Pushing to `window.dataLayer` is harmless even when the merchant hasn't
 * installed a tracking script — it's just an array. If they later paste a
 * GTM snippet (see setCustomHeadScript), these events start feeding it
 * immediately with no further integration work on their side.
 */

export interface AnalyticsItem {
  item_id: string
  item_name: string
  price: number
  quantity?: number
  item_variant?: string
}

function push(event: string, payload: Record<string, unknown>): void {
  const w = window as unknown as { dataLayer?: unknown[] }
  if (!Array.isArray(w.dataLayer)) w.dataLayer = []
  w.dataLayer.push({ event, ...payload })
}

/** Fired on every storefront route change — the SPA never triggers a real
 * page load after the first one, so GTM's default "All Pages" trigger only
 * fires once per visit. A GTM Custom Event trigger on `virtual_page_view`
 * catches every in-app navigation instead. */
export function trackPageView(path: string, title?: string): void {
  push('virtual_page_view', { page_path: path, page_title: title || document.title, page_location: window.location.href })
}

export function trackViewItem(item: AnalyticsItem, currency: string): void {
  push('view_item', { currency, value: item.price, items: [item] })
}

export function trackAddToCart(item: AnalyticsItem, currency: string): void {
  push('add_to_cart', { currency, value: item.price * (item.quantity || 1), items: [item] })
}

export function trackBeginCheckout(items: AnalyticsItem[], value: number, currency: string): void {
  push('begin_checkout', { currency, value, items })
}

export function trackPurchase(input: {
  transactionId: string
  value: number
  currency: string
  shipping?: number
  items: AnalyticsItem[]
}): void {
  push('purchase', {
    transaction_id: input.transactionId,
    value: input.value,
    currency: input.currency,
    shipping: input.shipping,
    items: input.items,
  })
}
