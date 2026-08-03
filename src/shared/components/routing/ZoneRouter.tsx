import { FunctionalComponent } from 'preact'
import { Switch, useLocation, Redirect } from 'wouter'
import { useAuth } from '../../hooks/useAuth'
import { Loading } from '../ui/Loading'
import { EmptyState } from '../ui/EmptyState'
import type { Role } from '../../types'

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

  // Pending-approval gate: a merchant/staff account that has not been
  // approved by Platform Admin (users.active === false) must not enter the
  // dashboard. superAdmin is always active.
  if (user.role !== 'superAdmin' && user.active === false) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="order-confirmed">
            <div className="big-check">
              <span className="material-symbols-outlined">hourglass_top</span>
            </div>
            <h1 className="auth-title">الحساب قيد المراجعة</h1>
            <p className="auth-subtitle">
              حسابك لم يتم تفعيله بعد. سيتم تفعيله فور موافقة إدارة المنصة على اشتراكك.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Staff RBAC: when a permission is declared for the zone/route, enforce it.
  if (user.role === 'staff' && permission) {
    const perms = user.permissions || []
    if (!perms.includes(permission)) {
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
