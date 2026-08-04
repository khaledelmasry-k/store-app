import { FunctionalComponent, Fragment } from 'preact'
import { useState, useEffect, useCallback } from 'preact/hooks'
import { Link, useLocation } from 'wouter'
import { doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { logout, exitImpersonationCallable } from '../../services/auth'
import { Avatar } from '../ui/Avatar'
import { Dropdown } from '../ui/Dropdown'
import { db } from '../../firebase'
import { NAV_GROUPS, type NavGroup, type NavItem } from '../../utils/constants'

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
          <span className="material-symbols-outlined">admin_panel_settings</span>
          <span>أنت تتصفح المتجر كتاجر (وضع التجسس من مدير المنصة)</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleExitImpersonation} disabled={exiting}>
            {exiting ? 'جاري الخروج...' : 'الخروج من وضع التجسس'}
          </button>
        </div>
      )}
      <div className="sidebar-brand">
        <span className="material-symbols-outlined">storefront</span>
        <strong>{brand}</strong>
      </div>
      {storefrontHref && (
        <a href={storefrontHref} className="sidebar-link" target="_blank" rel="noopener noreferrer">
          <span className="material-symbols-outlined">storefront</span>
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
                <span className="material-symbols-outlined sidebar-group-icon">{group.icon}</span>
                <span className="sidebar-group-label">{group.label}</span>
                <span className={`material-symbols-outlined sidebar-chevron${open ? ' open' : ''}`}>expand_more</span>
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
                      <span className="material-symbols-outlined sidebar-child-icon">{item.icon}</span>
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
        <button type="button" className="sidebar-link" onClick={theme.toggle}>
          <span className="material-symbols-outlined">{theme.theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          <span>{theme.theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
        </button>
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
            <div className="topbar-spacer">
              <button
                type="button"
                className="btn btn-ghost sidebar-toggle"
                aria-label="فتح القائمة"
                onClick={() => setDrawerOpen(true)}
              >
                <span className="material-symbols-outlined">menu</span>
              </button>
            </div>
            {multiStore && (
              <div className="topbar-store" style={{ marginInlineEnd: 12 }}>
                <Dropdown
                  align="left"
                  trigger={
                    <button type="button" className="btn btn-outline btn-sm">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>store</span>
                      <span>{(stores.find((s) => s.id === storeSwitcher?.currentId)?.name || brand)}</span>
                    </button>
                  }
                  items={stores.map((s) => ({
                    label: s.name,
                    icon: s.id === storeSwitcher?.currentId ? 'check' : 'storefront',
                    onClick: () => handleSwitchStore(s.id),
                  }))}
                />
              </div>
            )}
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
                  { label: 'تسجيل الخروج', icon: 'logout', danger: true, onClick: handleLogout },
                ]}
              />
            </div>
          </header>
          <main className="shell-content">{children}</main>
        </div>
      </div>
      {drawerOpen && (
        <div className="sidebar-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="sidebar-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-drawer-header">
              <span className="material-symbols-outlined">storefront</span>
              <strong>{brand}</strong>
              <button type="button" className="btn btn-ghost" aria-label="إغلاق القائمة" onClick={() => setDrawerOpen(false)}>
                <span className="material-symbols-outlined">close</span>
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