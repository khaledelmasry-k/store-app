import { createContext } from 'preact'

export interface ToastItem {
  id: number
  title: string
  description?: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export interface ToastState {
  toasts: ToastItem[]
  push: (title: string, description?: string, type?: ToastItem['type']) => void
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastState>({
  toasts: [],
  push: () => {},
  dismiss: () => {},
})
