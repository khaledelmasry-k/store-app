import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useAuth } from '../../shared/hooks/useAuth'
import { useCart } from '../../shared/hooks/useCart'
import { useStore } from '../../shared/hooks/useStore'
import { logout } from '../../shared/services/auth'
import { Avatar } from '../../shared/components/ui/Avatar'
import { Dropdown } from '../../shared/components/ui/Dropdown'
import { Icon } from '../../shared/components/ui/Icon'
import { MerchantLogo } from '../../shared/components/brand/MerchantLogo'
import './StorefrontHeader.css'

interface NavItem {
  to: string
  label: string
}

interface Props {
  base: string
  navItems: NavItem[]
  location: string
  menuOpen: boolean
  onMenuToggle: (open: boolean) => void
  q: string
  onQChange: (q: string) => void
  onSearchSubmit: (e: Event) => void
  showSearch: boolean
  storeDark: boolean
  onToggleDark: () => void
}

/**
 * Storefront header rebuilt from the real Stitch storefront sources:
 *  - desktop:  M&K Store | Premium Consumer Storefront Home (56916061f03346f78802151c20218370)
 *  - mobile:   M&K Store | Refined Mobile Storefront Experience (46368a57a55d4c4d95b73c89b5dd8680)
 * Desktop = sticky surface bar, 1440px inner, px-8 py-4, brand wordmark,
 * underline-active nav (gap-8), 256px search pill (>=1024px), round icon
 * controls (cart / account / theme). Mobile = 64px row (menu + centered
 * brand + person/cart in primary) with a dedicated 44px search row below.
 */
export const StorefrontHeader: FunctionalComponent<Props> = ({
  base,
  navItems,
  location,
  menuOpen,
  onMenuToggle,
  q,
  onQChange,
  onSearchSubmit,
  showSearch,
  storeDark,
  onToggleDark,
}) => {
  const { store } = useStore()
  const { user } = useAuth()
  const cart = useCart()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isActive = (to: string) =>
    to === base ? location === base || location === `${base}/` : location.startsWith(to)

  const accountMenuItems = user && user.role === 'customer'
    ? [
        { label: 'حسابي', icon: 'account_circle', onClick: () => (window.location.href = `${base}/account`) },
        { label: 'تسجيل الخروج', icon: 'logout', danger: true, onClick: () => logout().then(() => window.location.reload()) },
      ]
    : []

  const cartLabel = `السلة${cart.count > 0 ? `، ${cart.count} منتج` : '، فارغة'}`

  const searchField = (variant: string) => (
    <form className={`storefront-search ${variant}`} onSubmit={onSearchSubmit} role="search">
      <Icon name="search" className="storefront-search-icon" ariaHidden />
      <input
        className="storefront-search-input"
        value={q}
        onInput={(e: any) => onQChange(e.currentTarget.value)}
        placeholder="ابحث عن منتجات..."
        aria-label="البحث عن المنتجات"
      />
    </form>
  )

  return (
    <>
      <header className={`storefront-header${scrolled ? ' storefront-header--scrolled' : ''}`}>
        <div className="storefront-header-inner">
          <button
            type="button"
            className="storefront-menu-btn"
            onClick={() => onMenuToggle(!menuOpen)}
            title="القائمة"
            aria-label="القائمة"
            aria-expanded={menuOpen}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>

          <Link href={base} className="storefront-brand" aria-label={store?.name || 'M&K Store'}>
            <MerchantLogo store={store} variant="header" />
          </Link>

          <nav className="storefront-nav" role="navigation" aria-label="التنقل الرئيسي">
            {navItems.map((n) => (
              <Link key={n.to} href={n.to} className={`storefront-nav-link${isActive(n.to) ? ' storefront-nav-link--active' : ''}`}>
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="storefront-controls">
            {showSearch && searchField('storefront-search--desktop')}

            <div className="storefront-icons">
              <button
                type="button"
                className="storefront-icon-btn storefront-theme-btn"
                onClick={onToggleDark}
                aria-label={storeDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
                title="تغيير الوضع"
              >
                <Icon name={storeDark ? 'light_mode' : 'dark_mode'} />
              </button>

              <Link href={`${base}/cart`} className="storefront-icon-btn storefront-cart-btn" title="السلة" aria-label={cartLabel}>
                <Icon name="shopping_cart" />
                {cart.count > 0 && <span className="storefront-cart-badge" aria-hidden="true">{cart.count > 99 ? '99+' : cart.count}</span>}
              </Link>

              {user && user.role === 'customer' ? (
                <Dropdown
                  align="left"
                  trigger={
                    <button type="button" className="storefront-icon-btn storefront-account-btn" aria-label="حساب المستخدم" title="حسابي">
                      <Avatar name={user.name} size="sm" />
                    </button>
                  }
                  items={accountMenuItems}
                />
              ) : (
                <Link href={`${base}/login`} className="storefront-icon-btn storefront-account-btn" title="تسجيل الدخول" aria-label="تسجيل الدخول">
                  <Icon name="person" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {showSearch && <div className="storefront-search-row">{searchField('storefront-search--mobile')}</div>}
      </header>

      {menuOpen && (
        <div className="storefront-drawer" role="dialog" aria-modal="true" aria-label="القائمة">
          <nav className="storefront-drawer-nav" role="navigation">
            {navItems.map((n) => (
              <Link
                key={n.to}
                href={n.to}
                className={`storefront-drawer-link${isActive(n.to) ? ' storefront-drawer-link--active' : ''}`}
                onClick={() => onMenuToggle(false)}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}

export default StorefrontHeader