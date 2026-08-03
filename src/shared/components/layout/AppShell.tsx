import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { Link, useLocation } from 'wouter'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { logout, exitImpersonationCallable } from '../../services/auth'
import { Avatar } from '../ui/Avatar'
import { Dropdown } from '../ui/Dropdown'
import { NAV_ITEMS, ROUTE_PERMISSIONS } from '../../utils/constants'

interface Props {
  navKey: 'platform' | 'dashboard'
  brand: string
  children?: any
}

export const AppShell: FunctionalComponent<Props> = ({ navKey, brand, children }) => {
  const { user } = useAuth()
  const theme = useTheme()
  const [location] = useLocation()
  const [exiting, setExiting] = useState(false)

  const handleLogout = async () => {
    await logout()
    window.location.href = `/login?role=${navKey === 'platform' ? 'platform' : 'merchant'}`
  }

  const handleExitImpersonation = async () => {
    setExiting(true)
    try {
      await exitImpersonationCallable()
      await logout()
      window.location.href = '/login?role=platform'
    } finally {
      setExiting(false)
    }
  }

  // Staff see only the nav items their permissions allow; merchants see all.
  const isStaff = user?.role === 'staff'
  const visibleNav = NAV_ITEMS[navKey].filter((item) => {
    if (!isStaff) return true
    const required = ROUTE_PERMISSIONS[item.to]
    if (!required) return true
    return (user?.permissions || []).includes(required)
  })

  const impersonating = Boolean(user?.impersonatedBy)

  return (
    <Fragment>
      {impersonating && (
        <div className="impersonation-banner">
          <span className="material-symbols-outlined">admin_panel_settings</span>
          <span>أنت تتصفح المتجر كتاجر (وضع التجسس من مدير المنصة)</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleExitImpersonation} disabled={exiting}>
            {exiting ? 'جاري الخروج...' : 'الخروج من وضع التجسس'}
          </button>
        </div>
      )}
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="material-symbols-outlined">storefront</span>
            <strong>{brand}</strong>
          </div>
          <nav className="sidebar-nav">
            {visibleNav.map((item) => {
              const active = item.to === `/${navKey}` ? location === item.to : location.startsWith(item.to)
              return (
                <Link key={item.to} href={item.to} className={`sidebar-link${active ? ' active' : ''}`}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
          <div className="sidebar-foot">
            <button type="button" className="sidebar-link" onClick={theme.toggle}>
              <span className="material-symbols-outlined">{theme.theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
              <span>{theme.theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
            </button>
          </div>
        </aside>
        <div className="shell-main">
          <header className="topbar">
            <div className="topbar-spacer" />
            <div className="topbar-user">
              <Dropdown
                align="left"
                trigger={
                  <button type="button" className="user-chip">
                    <Avatar name={user?.name || '?'} size="sm" src={user?.photoURL} />
                    <span>{user?.name}</span>
                    <span className="material-symbols-outlined">expand_more</span>
                  </button>
                }
                items={[
                  { label: 'الملف الشخصي', icon: 'account_circle' },
                  { divider: true },
                  { label: 'تسجيل الخروج', icon: 'logout', danger: true, onClick: handleLogout },
                ]}
              />
            </div>
          </header>
          <main className="shell-content">{children}</main>
        </div>
      </div>
    </Fragment>
  )
}
