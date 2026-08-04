import { FunctionalComponent } from 'preact'
import { useAuth } from '../../hooks/useAuth'
import { Loading } from '../ui/Loading'

interface Props {
  children?: any
}

export const PublicOnly: FunctionalComponent<Props> = ({ children }) => {
  const { loading, initialized } = useAuth()
  if (!initialized || loading) return <Loading />
  return <>{children}</>
}
