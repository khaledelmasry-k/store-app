import { FunctionalComponent, Fragment } from 'preact'
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks'
import { Link, useLocation } from 'wouter'
import { doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { logout, exitImpersonationCallable } from '../../services/auth'
import { Avatar } from '../ui/Avatar'
import { Dropdown } from '../ui/Dropdown'
import { db } from '../../firebase'
import { NAV_GROUPS, ROLE_LABELS, type NavGroup, type NavItem } from '../../utils/constants'
import { Icon } from '../ui/Icon'

interface Props {
  navKey: 'platform' | 'dashboard'
  brand: string
  storeSwitcher?: { storeIds: string[]; currentId: string; onSwitch: (id: string | null) => void }
  storefrontHref?: string
  children?: any
}

export const AppShell: FunctionalComponent<Props> = ({ navKey, brand, storeSwitcher, storefrontHref, children }) => {
  const { user } = useAuth()
  const theme = useTheme()
  const [location] = useLocation()
  const [exiting, setExiting] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { data: stores } = useStoresForSwitcher(storeSwitcher?.storeIds || [])
  const multiStore = storeSwitcher && (storeSwitcher.storeIds.length > 1)

  const isStaff = user?.role === 'staff'

  const pageContext = useMemo(() => {
    const path = location.split('?')[0]
    for (const group of NAV_GROUPS[navKey]) {
      for (const item of group.items) {
        const itemPath = item.to.split('?')[0]
        const isZoneRoot = /^\/[^/]+\/?$/.test(itemPath)
        if (path === itemPath || path === itemPath.replace(/\/$/, '') + '/') {
          return { group: group.label, item: item.label }
        }
        if (!isZoneRoot && path.startsWith(itemPath + '/')) {
          return { group: group.label, item: item.label }
        }
      }
    }
    return null
  }, [location, navKey])

  const notificationsHref = navKey === 'platform' ? '/platform/notifications' : '/dashboard/notifications'

  const [groupsState, setGroupsState] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const initial: Record<string, boolean> = {}
    const groups = NAV_GROUPS[navKey]
    for (const g of groups) {
      initial[g.id] = g.items.some((item) => {
        const itemPath = item.to.split('?')[0]
        return location === itemPath || location.startsWith(itemPath + '/')
      })
    }
    setGroupsState(initial)
  }, [location, navKey])

  const toggleGroup = useCallback((groupId: string) => {
    setGroupsState((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }, [])

  const handleSwitchStore = (id: string) => {
    storeSwitcher?.onSwitch(id)
    window.location.reload()
  }

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

  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => {
      const itemPath = item.to.split('?')[0]
      return location === itemPath || location.startsWith(itemPath + '/')
    })
  }

  const isItemActive = (item: NavItem) => {
    const itemPath = item.to.split('?')[0]
    return location === itemPath || location.startsWith(itemPath + '/')
  }

  const visibleGroups = NAV_GROUPS[navKey].filter((group) => {
    return group.items.some((item) => {
      if (!isStaff) return true
      const perm = item.permission
      if (!perm) return true
      return (user?.permissions || []).includes(perm)
    })
  })

  const filteredItems = (group: NavGroup) => {
    return group.items.filter((item) => {
      if (!isStaff) return true
      const perm = item.permission
      if (!perm) return true
      return (user?.permissions || []).includes(perm)
    })
  }

  const impersonating = Boolean(user?.impersonatedBy)

  const sidebarContent = (
    <Fragment>
      {impersonating && (
        <div className="impersonation-banner">
          <Icon name="admin_panel_settings" />
          <span>أنت تتصفح المتجر كتاجر (وضع التجسس من مدير المنصة)</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleExitImpersonation} disabled={exiting}>
            {exiting ? 'جاري الخروج...' : 'الخروج من وضع التجسس'}
          </button>
        </div>
      )}
      <div className="sidebar-brand">
        <span className="brand-mark">MK</span>
        <div className="brand-text">
          <strong>{brand}</strong>
          <span className="brand-sub">{navKey === 'platform' ? 'منصة المتاجر' : 'لوحة التاجر'}</span>
        </div>
      </div>
      {storefrontHref && (
        <a href={storefrontHref} className="sidebar-link" target="_blank" rel="noopener noreferrer">
          <Icon name="storefront" />
          <span>متجري (المتجر الإلكتروني)</span>
        </a>
      )}
      <nav className="sidebar-nav" aria-label="التنقل الرئيسي">
        {visibleGroups.map((group) => {
          const open = groupsState[group.id] !== false
          const active = isGroupActive(group)
          const items = filteredItems(group)
          if (!items.length) return null
          return (
            <div key={group.id} className="sidebar-group">
              <button
                type="button"
                className={`sidebar-group-header${active ? ' active' : ''}`}
                onClick={() => toggleGroup(group.id)}
                aria-expanded={open}
              >
                <Icon name={group.icon} className="sidebar-group-icon" />
                <span className="sidebar-group-label">{group.label}</span>
                <Icon name="keyboard_arrow_down" className={`sidebar-chevron${open ? ' open' : ''}`} />
              </button>
              <div className={`sidebar-group-items${open ? ' open' : ''}`}>
                {items.map((item) => {
                  const itemActive = isItemActive(item)
                  return (
                    <Link
                      key={item.to}
                      href={item.to}
                      className={`sidebar-link sidebar-child-link${itemActive ? ' active' : ''}`}
                      onClick={() => setDrawerOpen(false)}
                    >
                      <Icon name={item.icon} className="sidebar-child-icon" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>
      <div className="sidebar-foot">
        <span className="sidebar-foot-user">
          <Avatar name={user?.name || '?'} size="sm" src={user?.photoURL} />
          <span>
            <strong>{user?.name}</strong>
            <small>{user?.role ? ROLE_LABELS[user.role] : ''}</small>
          </span>
        </span>
      </div>
    </Fragment>
  )

  return (
    <Fragment>
      <div className="app-shell">
        <aside className="sidebar" id="sidebar">
          {sidebarContent}
        </aside>
        <div className="shell-main">
          <header className="topbar">
            <div className="topbar-main">
              <button
                type="button"
                className="btn btn-ghost sidebar-toggle"
                aria-label="فتح القائمة"
                onClick={() => setDrawerOpen(true)}
              >
                <Icon name="menu" />
              </button>
              {pageContext ? (
                <nav className="topbar-crumb" aria-label="مسار الصفحة">
                  <span className="crumb-parent">{pageContext.group}</span>
                  <span className="crumb-sep">/</span>
                  <span className="crumb-current">{pageContext.item}</span>
                </nav>
              ) : (
                <span className="topbar-brand-inline">{brand}</span>
              )}
            </div>
            <div className="topbar-actions">
              {multiStore && (
                <Dropdown
                  align="left"
                  trigger={
                    <button type="button" className="btn btn-outline btn-sm">
                      <Icon name="store" style={{ fontSize: 16 }} />
                      <span>{(stores.find((s) => s.id === storeSwitcher?.currentId)?.name || brand)}</span>
                    </button>
                  }
                  items={stores.map((s) => ({
                    label: s.name,
                    icon: s.id === storeSwitcher?.currentId ? 'check' : 'storefront',
                    onClick: () => handleSwitchStore(s.id),
                  }))}
                />
              )}
              <Link href={notificationsHref} className="topbar-icon-btn" aria-label="الإشعارات" title="الإشعارات">
                <Icon name="notifications" />
              </Link>
              <button
                type="button"
                className="topbar-icon-btn"
                aria-label="تبديل السمة"
                title={theme.theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
                onClick={theme.toggle}
              >
                <Icon name={theme.theme === 'dark' ? 'light_mode' : 'dark_mode'} />
              </button>
              <div className="topbar-user">
                <Dropdown
                  align="left"
                  trigger={
                    <button type="button" className="user-chip">
                      <Avatar name={user?.name || '?'} size="sm" src={user?.photoURL} />
                      <span className="user-chip-meta">
                        <strong>{user?.name}</strong>
                        <small>{user?.role ? ROLE_LABELS[user.role] : ''}</small>
                      </span>
                      <Icon name="keyboard_arrow_down" />
                    </button>
                  }
                  items={[
                    { label: 'تسجيل الخروج', icon: 'logout', danger: true, onClick: handleLogout },
                  ]}
                />
              </div>
            </div>
          </header>
          <main className="shell-content">{children}</main>
        </div>
      </div>
      {drawerOpen && (
        <div className="sidebar-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="sidebar-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-drawer-header">
              <span className="brand-mark brand-mark-sm">MK</span>
              <strong>{brand}</strong>
              <button type="button" className="btn btn-ghost" aria-label="إغلاق القائمة" onClick={() => setDrawerOpen(false)}>
                <Icon name="close" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}
    </Fragment>
  )
}

function useStoresForSwitcher(ids: string[]) {
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const idsKey = JSON.stringify(ids)
  useEffect(() => {
    if (!ids.length) {
      setStores([])
      return
    }
    const unsubs = ids.map((id) =>
      onSnapshot(doc(db, 'stores', id), (snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setStores((prev) => {
            const next = prev.filter((s) => s.id !== id)
            return [...next, { id, name: d.name || id }]
          })
        }
      }),
    )
    return () => unsubs.forEach((u) => u())
  }, [ids, idsKey])
  return { data: stores }
}