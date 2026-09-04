import { FunctionalComponent } from 'preact'
import { Switch, useLocation, Redirect, Link } from 'wouter'
import { useAuth } from '../../hooks/useAuth'
import { Loading } from '../ui/Loading'
import { EmptyState } from '../ui/EmptyState'
import { ROUTE_PERMISSIONS } from '../../utils/constants'
import type { Role } from '../../types'
import { Icon } from '../ui/Icon'
import { useSubscription } from '../../hooks/useSubscription'
import { canUseFeature, getPlanLimit } from '../../services/subscription'
import { logout } from '../../services/auth'

interface ZoneRouterProps {
  prefix: string
  role: Role
  layout?: FunctionalComponent<any>
  permission?: string
  children: any
}

function stripPrefix(path: string, prefix: string): string {
  if (path === prefix) return '/'
  if (path.startsWith(prefix + '/')) return path.slice(prefix.length)
  return '/'
}

export const ZoneRouter: FunctionalComponent<ZoneRouterProps> = ({ prefix, role, permission, layout: Layout, children }) => {
  const [loc] = useLocation()
  const { user, loading, initialized } = useAuth()
  const entitlementStoreId = role === 'merchant' && user?.role === 'merchant' ? (user.storeIds?.[0] || '') : ''
  const entitlement = useSubscription(entitlementStoreId)

  if (!initialized || loading) return <Loading />

  if (!user) {
    const loginRole = role === 'superAdmin' ? 'platform' : 'merchant'
    return <Redirect to={`/login?role=${loginRole}`} replace />
  }

  const isAllowed =
    user.role === role || (role === 'merchant' && user.role === 'staff')

  if (!isAllowed) {
    if (user.role === 'superAdmin') return <Redirect to="/platform/" replace />
    if (user.role === 'merchant' || user.role === 'staff') return <Redirect to="/dashboard/" replace />
    return <Redirect to="/" replace />
  }

  const merchantPending = user.role !== 'superAdmin' && (
    user.active === false ||
    (user.role === 'merchant' && user.merchantStatus != null && user.merchantStatus !== 'active')
  )

  if (merchantPending) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="order-confirmed">
            <div className="big-check">
              <Icon name="hourglass_top" />
            </div>
            <h1 className="auth-title">طلبك قيد المراجعة</h1>
            <p className="auth-subtitle">
              تم إنشاء حسابك بنجاح، وسيتم تفعيل حسابك بعد مراجعة إدارة Matjari. لا يمكنك الوصول إلى لوحة التشغيل قبل الموافقة.
            </p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { void logout() }}
            >تسجيل الخروج</button>
          </div>
        </div>
      </div>
    )
  }

  const rawRouteKey = loc.split('?')[0]
  // `/dashboard` and `/dashboard/` are the same dashboard route. Normalize the
  // trailing slash before applying the expired-subscription gate so merchants
  // can still see their dashboard and subscription status after a trial ends.
  const routeKey = rawRouteKey.length > 1 ? rawRouteKey.replace(/\/+$/, '') : rawRouteKey
  if (user.role === 'merchant' && entitlementStoreId && !entitlement.loading && entitlement.status !== 'none') {
    const restricted = routeKey === '/dashboard/coupons' && !canUseFeature('coupons', entitlement.plan)
      || routeKey === '/dashboard/analytics' && !canUseFeature('analytics', entitlement.plan)
      || routeKey === '/dashboard/landing-pages' && getPlanLimit('landingPages', entitlement.plan) <= 0
      || routeKey === '/dashboard/store-links' && getPlanLimit('salesLinks', entitlement.plan) <= 0
      || routeKey === '/dashboard/team' && getPlanLimit('staff', entitlement.plan) <= 1
    const billingRoutes = routeKey === '/dashboard' || routeKey === '/dashboard/subscription'
    if (restricted || (entitlement.status !== 'active' && entitlement.status !== 'trialing' && !billingRoutes)) {
      return (
        <EmptyState
          icon="lock"
          title="هذه الميزة غير متاحة في باقتك الحالية"
          description="يمكنك مراجعة الباقات المتاحة لترقية المزايا والحدود."
          action={<Link href="/dashboard/subscription" className="btn btn-primary">عرض الباقات</Link>}
        />
      )
    }
  }
  const resolvedPermission = permission || ROUTE_PERMISSIONS[routeKey] || ROUTE_PERMISSIONS[Object.keys(ROUTE_PERMISSIONS).find((p) => routeKey.startsWith(p + '/')) || '']

  if (user.role === 'staff' && resolvedPermission) {
    const perms = user.permissions || []
    if (!perms.includes(resolvedPermission)) {
      return (
        <EmptyState
          title="صلاحيات غير كافية"
          description="حسابك لا يملك صلاحية الوصول إلى هذه الصفحة."
          icon="lock"
        />
      )
    }
  }

  if (!loc.startsWith(prefix) && loc !== prefix.replace(/\/$/, '')) {
    return <Redirect to={prefix} replace />
  }

  const innerLoc = stripPrefix(loc, prefix)

  const inner = (
    <Switch location={innerLoc}>
      {children}
    </Switch>
  )

  if (Layout) return <Layout>{inner}</Layout>
  return inner
}
