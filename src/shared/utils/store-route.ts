// Clean parsing of storefront URLs, e.g.
//   /store/demo-store
//   /store/demo-store?ref=ahmed
//   /store/demo-store?ref=ahmed&utm_source=facebook
//   /store/demo-store/catalog
// Returns the slug (query-stripped) and the parsed query params.
export interface StoreRoute {
  slug: string
  ref: string | null
  search: string
  innerPath: string
}

export function parseStoreLocation(loc: string): StoreRoute {
  const qIndex = loc.indexOf('?')
  const path = qIndex >= 0 ? loc.slice(0, qIndex) : loc
  const search = qIndex >= 0 ? loc.slice(qIndex + 1) : ''
  const segments = path.split('/').filter(Boolean)

  let slug = ''
  let innerPath = '/'
  if (segments[0] === 'store') {
    slug = segments[1] || ''
    innerPath = segments.length > 2 ? '/' + segments.slice(2).join('/') : '/'
  }

  const params = new URLSearchParams(search)
  const ref = params.get('ref')

  return { slug, ref, search, innerPath }
}
