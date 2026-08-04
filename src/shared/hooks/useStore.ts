import { useContext } from 'preact/hooks'
import { StoreContext } from '../contexts/store-context'

export function useStore() {
  return useContext(StoreContext)
}
