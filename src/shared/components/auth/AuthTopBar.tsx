import { FunctionalComponent } from 'preact'
import { Link, useLocation } from 'wouter'
import { BrandMark } from '../brand/BrandMark'
import { useTheme } from '../../hooks/useTheme'
import { Icon } from '../ui/Icon'

// Light, sticky top navigation bar shared by all auth pages. Matches the
// public landing header so the brand and routes feel continuous.

export const AuthTopBar: FunctionalComponent = () => {
  const [location] = useLocation()
  const theme = useTheme()
  const onLogin = location === '/login'
  const onRegister = location === '/register'

  return (
    <header className="auth-topbar">
      <div className="auth-topbar-inner">
        <Link href="/" className="auth-topbar-brand">
          <BrandMark small />
          <span>M&amp;K Store</span>
        </Link>

        <nav className="auth-topbar-nav" aria-label="التنقل الرئيسي">
          <Link href="/" className="auth-topbar-link">الرئيسية</Link>
          <a href="/#pricing" className="auth-topbar-link">الأسعار</a>
        </nav>

        <div className="auth-topbar-actions">
          <button
            type="button"
            className="auth-topbar-btn auth-topbar-btn-icon"
            aria-label="تبديل السمة"
            title={theme.theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
            onClick={theme.toggle}
          >
            <Icon name={theme.theme === 'dark' ? 'light_mode' : 'dark_mode'} />
          </button>
          {!onLogin && (
            <Link href="/login" className="auth-topbar-btn auth-topbar-btn-ghost">تسجيل الدخول</Link>
          )}
          {!onRegister && (
            <Link href="/register" className="auth-topbar-btn auth-topbar-btn-primary">ابدأ مجاناً</Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default AuthTopBar