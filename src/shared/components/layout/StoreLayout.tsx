import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { useAuth } from '../../hooks/useAuth'
import { useCart } from '../../hooks/useCart'
import { useStore } from '../../hooks/useStore'
import { logout } from '../../services/auth'
import { Dropdown } from '../ui/Dropdown'
import { Avatar } from '../ui/Avatar'
import { useTheme } from '../../hooks/useTheme'

interface Props {
  children?: any
}

export const StoreLayout: FunctionalComponent<Props> = ({ children }) => {
  const { store } = useStore()
  const { user } = useAuth()
  const cart = useCart()
  const theme = useTheme()

  const nav = [
    { to: `/store/${store?.slug}`, label: 'الرئيسية' },
    { to: `/store/${store?.slug}/catalog`, label: 'المنتجات' },
    { to: `/store/${store?.slug}/track`, label: 'تتبع طلب' },
  ]

  return (
    <div className="store-shell">
      <header className="store-header">
        <Link href={`/store/${store?.slug}`} className="store-brand">
          {store?.logo ? (
            <img src={store.logo} alt={store.name} className="store-logo" />
          ) : (
            <span className="material-symbols-outlined">storefront</span>
          )}
          <strong>{store?.name || 'المتجر'}</strong>
        </Link>
        <nav className="store-nav">
          {nav.map((n) => (
            <Link key={n.to} href={n.to} className="store-nav-link">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="store-actions">
          <button type="button" className="icon-btn" onClick={theme.toggle} title="تغيير الوضع">
            <span className="material-symbols-outlined">{theme.theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <Link href={`/store/${store?.slug}/cart`} className="icon-btn cart-btn" title="السلة">
            <span className="material-symbols-outlined">shopping_cart</span>
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
                { label: 'حسابي', icon: 'account_circle', onClick: () => (window.location.href = `/store/${store?.slug}/account`) },
                { label: 'تسجيل الخروج', icon: 'logout', danger: true, onClick: () => logout().then(() => window.location.reload()) },
              ]}
            />
          ) : (
            <Link href={`/store/${store?.slug}/login`} className="btn btn-outline btn-sm">
              تسجيل الدخول
            </Link>
          )}
        </div>
      </header>
      <main className="store-content">{children}</main>
      <footer className="store-footer">
        <p>© {new Date().getFullYear()} {store?.name || 'M&K'} — جميع الحقوق محفوظة</p>
      </footer>
    </div>
  )
}
