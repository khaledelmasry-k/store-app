import { useContext } from 'preact/hooks'
import { ToastContext } from '../contexts/toast-context'

export function useToast() {
  return useContext(ToastContext)
}
