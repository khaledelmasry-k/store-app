/**
 * Lightweight client-side SEO helper for the SPA storefront.
 *
 * Crawlers that execute JS (and social scrapers to a degree) will pick these up.
 * For first-class crawler indexing a prerender/SSR step would still be needed,
 * but keeping title/description/OG/canonical correct here is the baseline for a
 * commercially present storefront.
 */

export interface SeoMeta {
  title?: string
  description?: string
  image?: string | null
  url?: string
  type?: string
  twitterCard?: 'summary' | 'summary_large_image'
}

function upsertMeta(selector: string, attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

export function setSeo(meta: SeoMeta): void {
  if (meta.title) document.title = meta.title

  if (meta.description) {
    upsertMeta('meta[name="description"]', 'name', 'description', meta.description)
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', meta.description)
  }
  if (meta.title) {
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', meta.title)
  }
  if (meta.type) upsertMeta('meta[property="og:type"]', 'property', 'og:type', meta.type)
  if (meta.url) {
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', meta.url)
    upsertLink('canonical', meta.url)
  }
  if (meta.image) {
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', meta.image)
    upsertMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', meta.title || 'M&K Store')
  }
  const card = meta.twitterCard || 'summary_large_image'
  upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', card)
  if (meta.title) upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title)
  if (meta.description) upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description)
  if (meta.image) upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', meta.image)
}
