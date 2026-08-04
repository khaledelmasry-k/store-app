import { createContext } from 'preact'
import type { Store } from '../types'

export interface StoreState {
  store: Store | null
  loading: boolean
  setStoreId: (id: string | null) => void
}

export const StoreContext = createContext<StoreState>({ store: null, loading: false, setStoreId: () => {} })
