import { FunctionalComponent } from 'preact'
import { Redirect, useLocation } from 'wouter'
import { useAuth } from '../../hooks/useAuth'
import { Loading } from '../ui/Loading'
import type { Role } from '../../types'

interface Props {
  role: Role
  children?: any
}

export const RequireRole: FunctionalComponent<Props> = ({ role, children }) => {
  const { user, loading, initialized } = useAuth()
  const [, navigate] = useLocation()

  if (!initialized || loading) return <Loading />

  if (!user) {
    navigate(`/login?role=${role}`, { replace: true })
    return <Loading />
  }

  if (user.role !== role) {
    if (user.role === 'superAdmin') return <Redirect to="/platform/" replace />
    if (user.role === 'merchant') return <Redirect to="/dashboard/" replace />
    return <Redirect to="/" replace />
  }

  return <>{children}</>
}
