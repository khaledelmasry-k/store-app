import { FunctionalComponent } from 'preact'
import { Link, useLocation } from 'wouter'
import { BrandLogo } from '../brand/BrandLogo'
import { useTheme } from '../../hooks/useTheme'
import { Icon } from '../ui/Icon'

export const AuthTopBar: FunctionalComponent = () => {
  const [location] = useLocation()
  const theme = useTheme()
  const onLogin = location === '/login'

  return (
    <header className="auth-topbar">
      <div className="auth-topbar-inner">
        <Link href="/" className="auth-brand">
          <BrandLogo className="auth-topbar-logo" />
        </Link>

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
          {onLogin ? (
            <Link href="/register" className="auth-topbar-btn auth-topbar-btn-ghost">إنشاء حساب</Link>
          ) : (
            <Link href="/login" className="auth-topbar-btn auth-topbar-btn-ghost">تسجيل الدخول</Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default AuthTopBar
