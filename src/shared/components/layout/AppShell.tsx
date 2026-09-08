import { FunctionalComponent, Fragment } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { Link, useLocation } from 'wouter'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { logout, exitImpersonationCallable } from '../../services/auth'
import { Avatar } from '../ui/Avatar'
import { Dropdown } from '../ui/Dropdown'
import { db } from '../../firebase'
import { NAV_GROUPS, ROLE_LABELS, type NavGroup, type NavItem } from '../../utils/constants'
import { Icon } from '../ui/Icon'
import './AppShell.css'
import { AdminSidebar } from './AdminSidebar'
import { AdminTopbar } from './AdminTopbar'
import { BrandLogo } from '../brand/BrandLogo'
import { BrandMark } from '../brand/BrandMark'
import { SmartImage } from '../ui/SmartImage'
import { presetFromLogo, storeLogoKind } from '../../utils/store-brand'
import { useSubscription } from '../../hooks/useSubscription'
import { canUseFeature, getPlanLimit, isPlanLimitUnlimited } from '../../services/subscription'
import { NotificationPopover } from '../notification/NotificationPopover'
import { useToast } from '../../hooks/useToast'

interface Props {
  navKey: 'platform' | 'dashboard'
  brand: string
  brandLogo?: string
  storeSwitcher?: { storeIds: string[]; currentId: string; onSwitch: (id: string | null) => void }
  storefrontHref?: string
  children?: any
}

interface CollapsedSidebarRailProps {
  groups: NavGroup[]
  isPinned: boolean
  displayName: string
  photoURL?: string | null
  storefrontHref?: string
  isGroupActive: (group: NavGroup) => boolean
  onPin: () => void
  onGroupClick: (groupId: string) => void
  onLogout: () => void
  onKeyDown: (event: KeyboardEvent) => void
}

/** Canonical collapsed rail used by both Merchant and SuperAdmin shells. */
const CollapsedSidebarRail: FunctionalComponent<CollapsedSidebarRailProps> = ({
  groups,
  isPinned,
  displayName,
  photoURL,
  storefrontHref,
  isGroupActive,
  onPin,
  onGroupClick,
  onLogout,
  onKeyDown,
}) => (
  <Fragment>
    <div className="sidebar-top">
      <button
        type="button"
        className="sidebar-pin-btn"
        aria-pressed={isPinned}
        aria-label="تثبيت القائمة"
        title="تثبيت القائمة"
        data-tip="تثبيت القائمة"
        onClick={onPin}
      >
        <Icon name="pin_off" ariaHidden />
      </button>
    </div>
    <nav className="sidebar-nav sidebar-nav-collapsed" aria-label="التنقل الرئيسي" onKeyDown={onKeyDown}>
      {groups.map((group) => {
        const active = isGroupActive(group)
        return (
          <section key={group.id} className={`sidebar-group${active ? ' active-child' : ''}`}>
            <button
              type="button"
              className={`sidebar-group-header${active ? ' active' : ''}`}
              data-nav
              data-tip={group.label}
              aria-expanded={false}
              onClick={() => onGroupClick(group.id)}
            >
              <Icon name={group.icon} className="sidebar-group-icon" ariaHidden />
            </button>
          </section>
        )
      })}
    </nav>
    <div className="sidebar-collapsed-spacer" aria-hidden="true" />
    <div className="sidebar-foot">
      {storefrontHref && (
        <a href={storefrontHref} className="sidebar-link" target="_blank" rel="noopener noreferrer" data-tip="متجري">
          <Icon name="storefront" className="sidebar-link-icon" />
        </a>
      )}
      <span className="sidebar-foot-user" data-tip={displayName}>
        <Avatar name={displayName} size="sm" src={photoURL} />
      </span>
      <button type="button" className="sidebar-link sidebar-logout" onClick={onLogout} data-tip="تسجيل الخروج">
        <Icon name="logout" className="sidebar-link-icon" />
      </button>
    </div>
  </Fragment>
)

export const AppShell: FunctionalComponent<Props> = ({ navKey, brand, brandLogo, storeSwitcher, storefrontHref, children }) => {
  const storefrontLabel = storefrontHref?.includes('preview=1') ? 'معاينة المتجر' : 'فتح المتجر المنشور'
  const { user } = useAuth()
  const toast = useToast()
  const theme = useTheme()
  const isDarkTheme = theme.theme === 'dark'
  const [location] = useLocation()
  useEffect(() => {
    document.title = navKey === 'platform' ? 'Matjari | إدارة المنصة' : 'Matjari | لوحة التاجر'
  }, [navKey])
  const [exiting, setExiting] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // The old shared preference could leave either console permanently in the
  // narrow icon rail after the rail geometry changed.  Start the refreshed
  // navigation expanded for both roles, while keeping any *new* choice per
  // console separate.
  const sidebarPreferenceKey = navKey === 'platform'
    ? 'platformSidebarPinnedV3'
    : 'merchantSidebarPinnedV2'
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(sidebarPreferenceKey)
      if (stored !== null) return stored === '1'
      // الإدارة تتبع الآن نفس rail لوحة التاجر: يبدأ كمسار أيقونات نظيف
      // ويتوسع فقط عند التثبيت أو المرور، بدل قائمة منصة منفصلة ومزدحمة.
      return navKey !== 'platform'
    } catch {
      return true
    }
  })
  const [isHoverExpanded, setIsHoverExpanded] = useState(false)
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data: stores } = useStoresForSwitcher(storeSwitcher?.storeIds || [])
  const multiStore = storeSwitcher && (storeSwitcher.storeIds.length > 1)
  const entitlementStoreId = navKey === 'dashboard' && user?.role === 'merchant'
    ? (storeSwitcher?.currentId || user.storeIds?.[0] || '')
    : ''
  const entitlement = useSubscription(entitlementStoreId)

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
        localStorage.setItem(sidebarPreferenceKey, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const isStaff = user?.role === 'staff'

  const notificationsHref = navKey === 'platform' ? '/platform/notifications' : '/dashboard/notifications'
  const helpHref = navKey === 'platform' ? '/platform/tickets' : '/dashboard/tickets'

  // Group state is intentionally ephemeral: each shell starts compact and
  // route navigation keeps only the active parent open.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const handleSwitchStore = (id: string) => {
    storeSwitcher?.onSwitch(id)
    window.location.reload()
  }

  const handleLogout = async () => {
    await logout()
    toast.push('تم تسجيل الخروج بنجاح', undefined, 'success')
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
        if (navKey === 'dashboard' && user?.role === 'merchant' && !entitlement.loading && entitlement.status !== 'none') {
          if (entitlement.status !== 'active' && entitlement.status !== 'trialing') return false
          if (item.entitlement === 'coupons' && !canUseFeature('coupons', entitlement.plan)) return false
          if (item.entitlement === 'analytics' && !canUseFeature('analytics', entitlement.plan)) return false
          if (item.quota === 'landingPages' && getPlanLimit('landingPages', entitlement.plan) <= 0) return false
          if (item.quota === 'salesLinks' && !isPlanLimitUnlimited('salesLinks', entitlement.plan) && getPlanLimit('salesLinks', entitlement.plan) <= 0) return false
          if (item.quota === 'staff' && getPlanLimit('staff', entitlement.plan) <= 1) return false
        }
        if (!isStaff) return true
        const perm = item.permission
        if (!perm) return true
        return (user?.permissions || []).includes(perm)
      }),
    }))
    .filter((group) => group.items.length > 0)

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = prev[id] ? {} : { [id]: true }
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
      const activeGroup = visibleGroups.find((group) => group.items.some(isItemActive))
      return activeGroup ? { [activeGroup.id]: true } : {}
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, navKey])

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
  const displayName = navKey === 'platform' ? 'خالد المصري' : (user?.name || '?')
  const merchantLogoKind = navKey === 'dashboard' ? storeLogoKind(brandLogo) : 'none'
  const merchantPreset = merchantLogoKind === 'preset' ? presetFromLogo(brandLogo) : null
  const hasMerchantLogo = navKey === 'dashboard' && merchantLogoKind === 'image'
  const merchantBrandMark = merchantLogoKind === 'image' ? (
    <SmartImage src={brandLogo || ''} alt={brand} className="merchant-console-logo" placeholderClassName="merchant-console-logo" />
  ) : merchantPreset ? (
    <span className="merchant-console-logo merchant-console-logo--preset" role="img" aria-label={brand}><Icon name={merchantPreset.icon} ariaHidden /></span>
  ) : null
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
          <span>أنت الآن داخل حساب {user?.name || 'التاجر'} بوضع الدعم</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleExitImpersonation} disabled={exiting}>
            {exiting ? 'جاري الخروج...' : 'العودة إلى إدارة المنصة'}
          </button>
        </div>
      )}
      <div className="sidebar-top">
        <Link
          href={navKey === 'platform' ? '/platform' : '/dashboard'}
          className="sidebar-console-brand"
          aria-label={navKey === 'platform' ? 'العودة إلى إدارة المنصة' : 'العودة إلى لوحة التاجر'}
          onClick={() => setDrawerOpen(false)}
        >
          {navKey === 'dashboard' ? (
            <span className="sidebar-console-logo-frame sidebar-console-logo-frame--merchant" aria-hidden="true">
              <Icon name="storefront" />
            </span>
          ) : <BrandMark small surface="light" />}
          <span>
            <strong>{navKey === 'dashboard' ? brand : 'Matjari'}</strong>
            <small>{navKey === 'platform' ? 'إدارة المنصة' : 'لوحة التاجر'}</small>
          </span>
        </Link>
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
                data-tour={navKey === 'dashboard' ? group.id : undefined}
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
                      data-tour={navKey === 'dashboard' ? ({
                        '/dashboard': 'dashboard',
                        '/dashboard/products': 'products',
                        '/dashboard/orders': 'orders',
                        '/dashboard/analytics': 'analytics',
                        '/dashboard/themes': 'themes',
                        '/dashboard/subscription': 'subscription',
                        '/dashboard/team': 'team',
                      } as Record<string, string>)[item.to] : undefined}
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
        <a href={storefrontHref} className="sidebar-link" target="_blank" rel="noopener noreferrer" data-tip={storefrontLabel}>
            <Icon name="storefront" className="sidebar-link-icon" />
          <span>{storefrontLabel}</span>
          </a>
        )}
        <span
          className="sidebar-foot-user"
          data-tip={displayName}
          style={{
            background: isDarkTheme ? '#17213a' : '#f3f5fb',
            borderColor: isDarkTheme ? '#2d3b53' : '#dfe4f0',
            color: isDarkTheme ? '#f3f6fb' : '#182033',
          }}
        >
          <Avatar name={displayName} size="sm" src={user?.photoURL} />
          <span>
            <strong style={{ color: isDarkTheme ? '#f3f6fb' : '#182033' }}>{displayName}</strong>
            <small style={{ color: isDarkTheme ? '#b3bdd3' : '#59657a' }}>{navKey === 'platform' ? 'مدير المنصة' : (user?.role ? ROLE_LABELS[user.role] : '')}</small>
          </span>
        </span>
        <button type="button" className="sidebar-link sidebar-logout" onClick={handleLogout} data-tip="تسجيل الخروج">
          <Icon name="logout" className="sidebar-link-icon" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </Fragment>
  )

  const collapsedSidebarContent = (
    <CollapsedSidebarRail
      groups={visibleGroups}
      isPinned={isPinned}
      displayName={displayName}
      photoURL={user?.photoURL}
      storefrontHref={storefrontHref}
      isGroupActive={(group) => group.items.some(isItemActive)}
      onPin={togglePin}
      onGroupClick={() => setIsHoverExpanded(true)}
      onLogout={handleLogout}
      onKeyDown={onNavKeyDown}
    />
  )

  return (
    <Fragment>
      <div
        className={`app-shell ${navKey === 'dashboard' ? 'merchant-chrome' : 'platform-chrome'} app-shell--${navKey} route-${routeClass}${isPinned ? '' : ' sidebar-unpinned'}${isHoverExpanded ? ' sidebar-hover-expanded' : ''}`}
        data-zone={navKey}
      >
          <AdminTopbar>
          <button
            type="button"
            className="btn btn-ghost sidebar-toggle"
            aria-label="فتح القائمة"
            onClick={() => setDrawerOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className={`topbar-brand${navKey === 'platform' ? ' topbar-brand--platform' : ''}${hasMerchantLogo ? ' topbar-brand--has-logo' : ''}`}>
            {navKey === 'platform' ? (
              <>
                <BrandLogo className="topbar-brand-logo" />
                <BrandMark className="topbar-brand-mark-platform" />
              </>
            ) : (
              <>
                {merchantBrandMark || <span className="topbar-brand-mark"><Icon name="storefront" /></span>}
                <div className="topbar-brand-meta">
                  <span className="topbar-brand-name">{brand}</span>
                  <span className="topbar-brand-sub">لوحة التاجر</span>
                </div>
              </>
            )}
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
              {navKey === 'dashboard' && <NotificationPopover storeId={storeSwitcher?.currentId} href={notificationsHref} />}
              {navKey === 'platform' && <Link href={notificationsHref} className="topbar-icon-btn" aria-label="الإشعارات" title="الإشعارات"><Icon name="notifications" /></Link>}
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
              <span className="topbar-avatar" title={displayName}>
                <Avatar name={displayName} size="sm" src={user?.photoURL} />
              </span>
            </div>
          </AdminTopbar>
          <div className="app-shell-body">
            <AdminSidebar
              onMouseEnter={handleSidebarEnter}
              onMouseMove={handleSidebarMove}
              onMouseLeave={handleSidebarLeave}
            >
              {!isPinned && !isHoverExpanded ? collapsedSidebarContent : sidebarContent}
            </AdminSidebar>
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
    let cancelled = false
    Promise.all(ids.map(async (id) => {
      const snap = await getDoc(doc(db, 'stores', id))
      if (!cancelled && snap.exists()) {
        const d = snap.data()
        setStores((prev) => {
          const next = prev.filter((s) => s.id !== id)
          return [...next, { id, name: d.name || id }]
        })
      }
    })).catch(() => {})
    return () => { cancelled = true }
  }, [ids, idsKey])
  return { data: stores }
}
