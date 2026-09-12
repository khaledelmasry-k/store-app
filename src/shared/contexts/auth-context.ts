import { createContext } from 'preact'
import type { User } from '../types'

export enum AuthState {
  Uninitialized = 'uninitialized',
  Loading = 'loading',
  Authenticated = 'authenticated',
  Unauthenticated = 'unauthenticated',
}

export interface AuthContextState {
  user: User | null
  loading: boolean
  initialized: boolean
  supportSessionActive: boolean
  state: AuthState
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextState>({
  user: null,
  supportSessionActive: false,
  loading: true,
  initialized: false,
  state: AuthState.Uninitialized,
  refreshUser: async () => {},
})
