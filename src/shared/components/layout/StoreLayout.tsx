import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link, useLocation } from 'wouter'
import { useAuth } from '../../hooks/useAuth'
import { setSeo } from '../../utils/seo'
import { useStore } from '../../hooks/useStore'
import { MerchantLogo } from '../brand/MerchantLogo'
import { getTemplate } from '../../utils/themes'
import { contrastFor, hexToRgba, shadeHex } from '../../utils/color'
import type { CSSProperties } from 'preact/compat'
import { Icon } from '../ui/Icon'
import { StorefrontHeader } from '../../../store/components/StorefrontHeader'
import { storeBaseUrl } from '../../utils/store-url'
import './StorefrontShell.css'

interface Props {
  children?: any
}

export function themeStyleFor(primary?: string, secondary?: string): CSSProperties {
  if (!primary) return {}
  return {
    '--primary': primary,
    '--primary-hover': shadeHex(primary, -12),
    '--primary-soft': hexToRgba(primary, 0.12),
    '--primary-contrast': contrastFor(primary),
    '--secondary': secondary || primary,
    '--store-accent': secondary || primary,
  } as CSSProperties
}

export const StorefrontShell: FunctionalComponent<Props> = ({ children }) => {
  const { store } = useStore()
  const { user } = useAuth()
  const [location, setLocation] = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [q, setQ] = useState('')

  const [storeDarkPref, setStoreDarkPref] = useState(() => {
    const saved = localStorage.getItem('mk-store-theme')
    if (saved === 'dark' || saved === 'light') return saved === 'dark'
    return !!store?.theme?.darkMode
  })
  const toggleStoreDark = () => setStoreDarkPref((v) => {
    const next = !v
    localStorage.setItem('mk-store-theme', next ? 'dark' : 'light')
    return next
  })
  useEffect(() => {
    setStoreDarkPref((prev) => {
      const saved = localStorage.getItem('mk-store-theme')
      return saved === null ? !!store?.theme?.darkMode : prev
    })
  }, [store?.id, store?.theme?.darkMode])

  const slug = store?.slug
  const base = `/store/${slug}`
  const template = getTemplate(store?.theme?.template)
  const templateClass = `${template.cssClass} theme-header-${template.layout.header} theme-hero-${template.layout.hero} theme-grid-${template.layout.productGrid} theme-card-${template.layout.productCard} theme-home-${template.layout.homeSections} theme-footer-${template.layout.footer} theme-product-${template.layout.productPage}`
  const storeDark = storeDarkPref ? ' store-dark' : ''

  // SEO: title, description, OG, Twitter, and canonical for the storefront.
  useEffect(() => {
    if (!store?.name) return
    const title = store.seoTitle || `${store.name} — متجر متجري`
    const description = store.seoDescription || store.description || `تسوق من ${store.name} على منصة متجري`
    setSeo({
      title,
      description,
      type: 'website',
      url: `${storeBaseUrl()}/store/${store.slug}`,
      image: store.logo || store.heroImage || store.hero || null,
    })
  }, [store?.name, store?.slug, store?.seoTitle, store?.seoDescription, store?.description, store?.logo, store?.heroImage, store?.hero])

  const canPreview =
    new URLSearchParams(window.location.search).get('preview') === '1'
      && !!user
      && (user.role === 'superAdmin' || (user.role === 'merchant' || user.role === 'staff') && (user.storeIds || []).includes(store?.id || ''))

  // Unpublished stores show a coming-soon page to everyone except the owner,
  // store staff, and platform admins. Purchases are rejected server-side too.
  if (store && (store.storeStatus || (store.published ? 'published' : 'draft')) !== 'published' && !canPreview) {
    return (
      <div className={`storefront-shell store-shell store-shell--v3 ${templateClass}${storeDark}`} style={themeStyleFor(store.theme?.primary, store.theme?.secondary)}>
        <div className="store-coming-soon">
          <Icon name="storefront" className="store-brand-mark" />
          <h1>{store.name}</h1>
          <p>{store.seoDescription || store.description || 'المتجر قيد الإعداد — سنعود قريباً بمنتجاتنا.'}</p>
          <a href="/" className="btn btn-invert btn-lg">العودة للرئيسية</a>
        </div>
      </div>
    )
  }

  const isHome = location === base || location === `${base}/`
  const isCatalog = location.startsWith(`${base}/catalog`)
  const isProduct = location.startsWith(`${base}/product`)

  const showSearch = isHome || isCatalog

  // Navigation matches Stitch home: Home, Catalog, Track Order.
  // Account lives in the header person icon, not the nav.
  const navItems = [
    { to: base, label: 'الرئيسية' },
    { to: `${base}/catalog`, label: isProduct ? 'التصنيفات' : 'المنتجات' },
    { to: `${base}/track`, label: 'تتبع طلب' },
  ]

  const submitSearch = (e: Event) => {
    e.preventDefault()
    setMenuOpen(false)
    setLocation(q ? `${base}/catalog?q=${encodeURIComponent(q)}` : `${base}/catalog`)
  }

  return (
    <div className={`storefront-shell store-shell store-shell--v3 ${templateClass}${storeDark}`} style={themeStyleFor(store?.theme?.primary, store?.theme?.secondary)}>
      <StorefrontHeader
        base={base}
        navItems={navItems}
        location={location}
        menuOpen={menuOpen}
        onMenuToggle={setMenuOpen}
        q={q}
        onQChange={setQ}
        onSearchSubmit={submitSearch}
        showSearch={showSearch}
        storeDark={storeDarkPref}
        onToggleDark={toggleStoreDark}
      />

      <main className="store-content" role="main">{children}</main>

      <footer className="store-footer" role="contentinfo">
        <div className="store-footer-grid">
          <div className="store-footer-brand-section">
            <div className="store-footer-brand">
              <MerchantLogo store={store} variant="footer" />
            </div>
            <p className="muted small">{store?.description || 'متجرك على منصة متجري'}</p>
          </div>
          <div>
            <h4>روابط سريعة</h4>
            <Link href={base} className="store-footer-link">الرئيسية</Link>
            <Link href={`${base}/catalog`} className="store-footer-link">المنتجات</Link>
            <Link href={`${base}/track`} className="store-footer-link">تتبع طلب</Link>
          </div>
          <div>
            <h4>الحساب</h4>
            <Link href={`${base}/account`} className="store-footer-link">حسابي</Link>
            <Link href={`${base}/cart`} className="store-footer-link">سلة التسوق</Link>
            {store?.phone && <span className="muted small ltr-text">{store.phone}</span>}
          </div>
          <div>
            <h4>الدعم</h4>
            <Link href={`${base}/track`} className="store-footer-link">تتبع الطلب</Link>
            <span className="store-footer-link store-footer-link--muted">سياسة الاسترجاع</span>
            {store?.phone ? <a href={`tel:${store.phone}`} className="store-footer-link ltr-text">تواصل معنا</a> : <span className="store-footer-link store-footer-link--muted">تواصل معنا</span>}
          </div>
        </div>
        <div className="store-footer-bottom">
          <p>© {new Date().getFullYear()} {store?.name || 'متجري'} — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  )
}

/** Backwards-compatible name for non-router imports; ownership is StorefrontShell. */
export const StoreLayout = StorefrontShell
