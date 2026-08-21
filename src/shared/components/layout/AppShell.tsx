import { FunctionalComponent, Fragment } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
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
import './AppShell.css'

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
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('merchantSidebarPinned')
      if (stored !== null) return stored === '1'
      return localStorage.getItem('merchantSidebarCollapsed') !== '1'
    } catch {
      return true
    }
  })
  const [isHoverExpanded, setIsHoverExpanded] = useState(false)
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data: stores } = useStoresForSwitcher(storeSwitcher?.storeIds || [])
  const multiStore = storeSwitcher && (storeSwitcher.storeIds.length > 1)

  const clearExpandTimer = () => {
    if (expandTimer.current) {
      clearTimeout(expandTimer.current)
      expandTimer.current = null
    }
  }

  const clearCollapseTimer = () => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
  }

  const handleSidebarEnter = () => {
    if (isPinned) return
    clearCollapseTimer()
    if (isHoverExpanded) return
    if (expandTimer.current) clearTimeout(expandTimer.current)
    expandTimer.current = setTimeout(() => {
      expandTimer.current = null
      setIsHoverExpanded(true)
    }, 600)
  }

  const handleSidebarMove = () => {
    if (isPinned) return
    clearCollapseTimer()
    if (isHoverExpanded) return
    if (expandTimer.current) clearTimeout(expandTimer.current)
    expandTimer.current = setTimeout(() => {
      expandTimer.current = null
      setIsHoverExpanded(true)
    }, 600)
  }

  const handleSidebarLeave = () => {
    clearExpandTimer()
    clearCollapseTimer()
    if (!isHoverExpanded) return
    collapseTimer.current = setTimeout(() => {
      collapseTimer.current = null
      setIsHoverExpanded(false)
    }, 200)
  }

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev
      try {
        localStorage.setItem('merchantSidebarPinned', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const isStaff = user?.role === 'staff'

  const notificationsHref = navKey === 'platform' ? '/platform/notifications' : '/dashboard/notifications'
  const helpHref = navKey === 'platform' ? '/platform/tickets' : '/dashboard/tickets'

  const storageKey = `mk-shell-open-groups:${navKey}`
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  })

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

  const isItemActive = (item: NavItem) => {
    const itemPath = item.to.split('?')[0]
    const path = location.split('?')[0].replace(/\/+$/, '')
    if (path === itemPath) return true
    if (itemPath === '/' || itemPath === '/dashboard' || itemPath === '/platform') return false
    return path.startsWith(itemPath + '/')
  }

  const visibleGroups: NavGroup[] = NAV_GROUPS[navKey]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!isStaff) return true
        const perm = item.permission
        if (!perm) return true
        return (user?.permissions || []).includes(perm)
      }),
    }))
    .filter((group) => group.items.length > 0)

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  useEffect(() => {
    return () => {
      if (expandTimer.current) clearTimeout(expandTimer.current)
      if (collapseTimer.current) clearTimeout(collapseTimer.current)
    }
  }, [])

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev }
      let changed = false
      for (const group of NAV_GROUPS[navKey]) {
        const hasActive = group.items.some(isItemActive)
        if (hasActive && !next[group.id]) {
          next[group.id] = true
          changed = true
        }
      }
      if (changed) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      }
      return prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  const onNavKeyDown = (e: KeyboardEvent) => {
    const navEl = e.currentTarget as HTMLDivElement
    const focusables = Array.from(navEl.querySelectorAll<HTMLElement>('button[data-nav], a[data-nav]'))
    const idx = focusables.indexOf(e.target as HTMLElement)
    if (idx < 0) return
    let next = idx
    if (e.key === 'ArrowDown') next = Math.min(idx + 1, focusables.length - 1)
    else if (e.key === 'ArrowUp') next = Math.max(idx - 1, 0)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = focusables.length - 1
    else return
    e.preventDefault()
    focusables[next]?.focus()
  }

  const impersonating = Boolean(user?.impersonatedBy)
  const routeClass = location
    .split('?')[0]
    .replace(/^\/+/, '')
    .replace(/\/+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '') || 'home'

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
      <div className="sidebar-top">
        <button
          type="button"
          className="sidebar-pin-btn"
          aria-pressed={isPinned}
          aria-label={isPinned ? 'إلغاء تثبيت القائمة' : 'تثبيت القائمة'}
          title={isPinned ? 'إلغاء تثبيت القائمة' : 'تثبيت القائمة'}
          data-tip={isPinned ? 'إلغاء تثبيت القائمة' : 'تثبيت القائمة'}
          onClick={togglePin}
        >
          <Icon name={isPinned ? 'pin' : 'pin_off'} ariaHidden />
        </button>
      </div>
      <nav className="sidebar-nav" aria-label="التنقل الرئيسي" onKeyDown={(e) => onNavKeyDown(e)}>
        {visibleGroups.map((group) => {
          const open = Boolean(openGroups[group.id])
          const hasActiveChild = group.items.some(isItemActive)
          return (
            <section key={group.id} className={`sidebar-group${open ? ' open' : ''}${hasActiveChild ? ' active-child' : ''}`}>
              <button
                type="button"
                className={`sidebar-group-header${hasActiveChild ? ' active' : ''}`}
                data-nav
                data-tip={group.label}
                aria-expanded={open}
                aria-controls={`sidebar-group-${group.id}`}
                onClick={() => {
                  if (!isPinned) {
                    if (!isHoverExpanded) {
                      setIsHoverExpanded(true)
                      return
                    }
                  }
                  toggleGroup(group.id)
                }}
              >
                <Icon name={group.icon} className="sidebar-group-icon" ariaHidden />
                <span className="sidebar-group-label">{group.label}</span>
                <Icon name="keyboard_arrow_down" className={`sidebar-chevron${open ? ' open' : ''}`} ariaHidden />
              </button>
              <div
                id={`sidebar-group-${group.id}`}
                className={`sidebar-group-items${open ? ' open' : ''}`}
                role="group"
                aria-label={group.label}
              >
                {group.items.map((item) => {
                  const itemActive = isItemActive(item)
                  return (
                    <Link
                      key={item.to}
                      href={item.to}
                      data-nav
                      data-tip={item.label}
                      className={`sidebar-child-link${itemActive ? ' active' : ''}`}
                      aria-current={itemActive ? 'page' : undefined}
                      onClick={() => setDrawerOpen(false)}
                    >
                      <Icon name={item.icon} className="sidebar-child-icon" ariaHidden />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
      </nav>
      <div className="sidebar-foot">
        {storefrontHref && (
          <a href={storefrontHref} className="sidebar-link" target="_blank" rel="noopener noreferrer" data-tip="متجري">
            <Icon name="storefront" className="sidebar-link-icon" />
            <span>متجري (المتجر الإلكتروني)</span>
          </a>
        )}
        <span className="sidebar-foot-user" data-tip={user?.name || ''}>
          <Avatar name={user?.name || '?'} size="sm" src={user?.photoURL} />
          <span>
            <strong>{user?.name}</strong>
            <small>{user?.role ? ROLE_LABELS[user.role] : ''}</small>
          </span>
        </span>
        <button type="button" className="sidebar-link sidebar-logout" onClick={handleLogout} data-tip="تسجيل الخروج">
          <Icon name="logout" className="sidebar-link-icon" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </Fragment>
  )

  return (
    <Fragment>
      <div
        className={`app-shell app-shell--${navKey} route-${routeClass}${isPinned ? '' : ' sidebar-unpinned'}${isHoverExpanded ? ' sidebar-hover-expanded' : ''}`}
        data-zone={navKey}
      >
        <header className="topbar">
          <button
            type="button"
            className="btn btn-ghost sidebar-toggle"
            aria-label="فتح القائمة"
            onClick={() => setDrawerOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="topbar-brand">
            <span className="topbar-brand-mark">
              <Icon name="storefront" />
            </span>
            <div className="topbar-brand-meta">
              <span className="topbar-brand-name">{brand}</span>
              <span className="topbar-brand-sub">{navKey === 'platform' ? 'منصة المتاجر' : 'لوحة التاجر'}</span>
            </div>
          </div>
          <label className="topbar-search">
            <Icon name="search" ariaHidden />
            <input type="search" placeholder="بحث سريع..." aria-label="بحث سريع" />
          </label>
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
              <Link href={helpHref} className="topbar-icon-btn" aria-label="الدعم والمساعدة" title="الدعم والمساعدة">
                <Icon name="support_agent" />
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
              <span className="topbar-divider" />
              <span className="topbar-avatar" title={user?.name || ''}>
                <Avatar name={user?.name || '?'} size="sm" src={user?.photoURL} />
              </span>
            </div>
          </header>
          <div className="app-shell-body">
            <aside
              className="sidebar"
              id="sidebar"
              onMouseEnter={handleSidebarEnter}
              onMouseMove={handleSidebarMove}
              onMouseLeave={handleSidebarLeave}
            >
              {sidebarContent}
            </aside>
            <div className="shell-main">
              <main className="shell-content">
                <div className="route-surface">{children}</div>
              </main>
            </div>
          </div>
        {navKey === 'dashboard' && (
          <nav className="mobile-bottom-nav" aria-label="تنقل سريع">
            {[
              { to: '/dashboard', label: 'الرئيسية', icon: 'dashboard' },
              { to: '/dashboard/orders', label: 'الطلبات', icon: 'shopping_cart' },
              { to: '/dashboard/products', label: 'المنتجات', icon: 'inventory_2' },
            ].map((item) => {
              const active = location === item.to || location.startsWith(item.to + '/')
              return (
                <Link key={item.to} href={item.to} className={`mobile-bottom-nav-item${active ? ' active' : ''}`}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
            <button type="button" className="mobile-bottom-nav-item" onClick={() => setDrawerOpen(true)}>
              <Icon name="menu" />
              <span>المزيد</span>
            </button>
          </nav>
        )}
      </div>
      {drawerOpen && (
        <div className="sidebar-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="sidebar-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-drawer-header">
              <strong>القائمة</strong>
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
