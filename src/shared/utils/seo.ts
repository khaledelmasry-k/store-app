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
    upsertMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', meta.title || 'Matjari — متجري')
  }
  const card = meta.twitterCard || 'summary_large_image'
  upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', card)
  if (meta.title) upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title)
  if (meta.description) upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description)
  if (meta.image) upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', meta.image)
}

const CUSTOM_SCRIPT_MARKER = 'data-mk-custom-head-script'

/**
 * Injects a merchant-supplied tracking snippet (GTM, Meta Pixel, ...) into
 * <head>. Elements set via innerHTML never execute their <script> tags (a
 * browser security rule), so each one is rebuilt as a real script node the
 * browser will run. Marked elements are removed first so switching stores,
 * or the merchant editing the snippet, doesn't stack up duplicates.
 */
export function setCustomHeadScript(raw: string | null | undefined): void {
  document.head.querySelectorAll(`[${CUSTOM_SCRIPT_MARKER}]`).forEach((el) => el.remove())
  const snippet = (raw || '').trim()
  if (!snippet) return
  const parsed = new DOMParser().parseFromString(snippet, 'text/html')
  const scripts = parsed.head.querySelectorAll('script')
  if (scripts.length === 0) {
    // Not <script>-wrapped (e.g. a bare gtag('config', ...) call) — run as-is.
    const el = document.createElement('script')
    el.setAttribute(CUSTOM_SCRIPT_MARKER, '1')
    el.textContent = snippet
    document.head.appendChild(el)
    return
  }
  scripts.forEach((source) => {
    const el = document.createElement('script')
    el.setAttribute(CUSTOM_SCRIPT_MARKER, '1')
    for (const attr of Array.from(source.attributes)) el.setAttribute(attr.name, attr.value)
    if (source.textContent) el.textContent = source.textContent
    document.head.appendChild(el)
  })
}
