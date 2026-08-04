import { useContext } from 'preact/hooks'
import { AuthContext } from '../contexts/auth-context'

export function useAuth() {
  return useContext(AuthContext)
}
