import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link, useLocation } from 'wouter'
import { useAuth } from '../../hooks/useAuth'
import { useCart } from '../../hooks/useCart'
import { useStore } from '../../hooks/useStore'
import { logout } from '../../services/auth'
import { Dropdown } from '../ui/Dropdown'
import { Avatar } from '../ui/Avatar'
import { SmartImage } from '../ui/SmartImage'
import { useTheme } from '../../hooks/useTheme'
import { getTemplate } from '../../utils/themes'
import { contrastFor, hexToRgba, shadeHex } from '../../utils/color'
import type { CSSProperties } from 'preact/compat'
import { Icon } from '../ui/Icon'

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

export const StoreLayout: FunctionalComponent<Props> = ({ children }) => {
  const { store } = useStore()
  const { user } = useAuth()
  const cart = useCart()
  const theme = useTheme()
  const [, setLocation] = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [q, setQ] = useState('')

  const slug = store?.slug
  const base = `/store/${slug}`
  const templateClass = getTemplate(store?.theme?.template).cssClass
  const storeDark = !!store?.theme?.darkMode ? ' store-dark' : ''

  // SEO: title + meta description for the storefront.
  useEffect(() => {
    if (!store?.name) return
    document.title = store.seoTitle || `${store.name} — متجر M&K`
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = store.seoDescription || store.description || `تسوق من ${store.name} على منصة M&K`
  }, [store?.name, store?.seoTitle, store?.seoDescription, store?.description])

  const canPreview =
    !!user && (user.role === 'superAdmin' || (user.role === 'merchant' || user.role === 'staff') && (user.storeIds || []).includes(store?.id || ''))

  // Unpublished stores show a coming-soon page to everyone except the owner,
  // store staff, and platform admins. Purchases are rejected server-side too.
  if (store && !store.published && !canPreview) {
    return (
      <div className={`store-shell ${templateClass}${storeDark}`} style={themeStyleFor(store.theme?.primary, store.theme?.secondary)}>
        <div className="store-coming-soon">
          <Icon name="storefront" className="store-brand-mark" />
          <h1>{store.name}</h1>
          <p>{store.seoDescription || store.description || 'المتجر قيد الإعداد — سنعود قريباً بمنتجاتنا.'}</p>
          <a href="/" className="btn btn-invert btn-lg">العودة للرئيسية</a>
        </div>
      </div>
    )
  }

  const nav = [
    { to: base, label: 'الرئيسية' },
    { to: `${base}/catalog`, label: 'المنتجات' },
    { to: `${base}/track`, label: 'تتبع طلب' },
    { to: `${base}/account`, label: 'حسابي' },
  ]

  const submitSearch = (e: Event) => {
    e.preventDefault()
    setMenuOpen(false)
    setLocation(q ? `${base}/catalog?q=${encodeURIComponent(q)}` : `${base}/catalog`)
  }

  const navLinks = (onClick?: () => void) =>
    nav.map((n) => (
      <Link key={n.to} href={n.to} className="store-nav-link" onClick={onClick}>
        {n.label}
      </Link>
    ))

  return (
    <div className={`store-shell ${templateClass}${storeDark}`} style={themeStyleFor(store?.theme?.primary, store?.theme?.secondary)}>
      <header className="store-header">
        <button type="button" className="icon-btn store-menu-btn" onClick={() => setMenuOpen(!menuOpen)} title="القائمة">
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
        <Link href={base} className="store-brand">
          {store?.logo ? (
            <SmartImage src={store.logo} alt={store.name} className="store-logo" placeholderClassName="store-logo" />
          ) : (
            <Icon name="storefront" className="store-brand-mark" />
          )}
          <strong>{store?.name || 'المتجر'}</strong>
        </Link>
        <nav className="store-nav">{navLinks()}</nav>
        <form className="store-search" onSubmit={submitSearch}>
          <Icon name="search" className="store-search-icon" />
          <input
            className="store-search-input"
            value={q}
            onInput={(e: any) => setQ(e.currentTarget.value)}
            placeholder="ابحث عن منتج..."
          />
        </form>
        <div className="store-actions">
          <button type="button" className="icon-btn" onClick={theme.toggle} title="تغيير الوضع">
            <Icon name={theme.theme === 'dark' ? 'light_mode' : 'dark_mode'} />
          </button>
          <Link href={`${base}/cart`} className="icon-btn cart-btn" title="السلة">
            <Icon name="shopping_cart" />
            {cart.count > 0 && <span className="cart-badge">{cart.count}</span>}
          </Link>
          {user && user.role === 'customer' ? (
            <Dropdown
              align="left"
              trigger={
                <button type="button" className="user-chip">
                  <Avatar name={user.name} size="sm" />
                  <span>{user.name.split(' ')[0]}</span>
                </button>
              }
              items={[
                { label: 'حسابي', icon: 'account_circle', onClick: () => (window.location.href = `${base}/account`) },
                { label: 'تسجيل الخروج', icon: 'logout', danger: true, onClick: () => logout().then(() => window.location.reload()) },
              ]}
            />
          ) : (
            <Link href={`${base}/login`} className="btn btn-outline btn-sm">
              تسجيل الدخول
            </Link>
          )}
        </div>
      </header>

      {menuOpen && (
        <div className="store-mobile-menu">
          <form className="store-search" onSubmit={submitSearch}>
            <Icon name="search" className="store-search-icon" />
            <input
              className="store-search-input"
              value={q}
              onInput={(e: any) => setQ(e.currentTarget.value)}
              placeholder="ابحث عن منتج..."
            />
          </form>
          <nav className="store-nav store-nav--mobile">{navLinks(() => setMenuOpen(false))}</nav>
        </div>
      )}

      <main className="store-content">{children}</main>

      <footer className="store-footer">
        <div className="store-footer-grid">
          <div>
            <div className="store-footer-brand">
              {store?.logo ? <SmartImage src={store.logo} alt={store.name} className="store-logo" placeholderClassName="store-logo" /> : <Icon name="storefront" />}
              <strong>{store?.name || 'M&K'}</strong>
            </div>
            <p className="muted small">{store?.description || 'متجرك على منصة M&K'}</p>
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
            {store?.phone && <span className="muted small">{store.phone}</span>}
          </div>
        </div>
        <div className="store-footer-bottom">
          <p>© {new Date().getFullYear()} {store?.name || 'M&K'} — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  )
}
