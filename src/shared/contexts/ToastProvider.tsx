import { FunctionalComponent } from 'preact'
import { useCallback, useRef, useState } from 'preact/hooks'
import { ToastContext, type ToastItem } from './toast-context'

export const ToastProvider: FunctionalComponent = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (title: string, description?: string, type: ToastItem['type'] = 'success') => {
      counter.current += 1
      const id = counter.current
      setToasts((prev) => [...prev.slice(-3), { id, title, description, type }])
      window.setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  return <ToastContext.Provider value={{ toasts, push, dismiss }}>{children}</ToastContext.Provider>
}
