import { FunctionalComponent } from 'preact'
import { useToast } from '../../hooks/useToast'
import { clsx } from '../../utils/clsx'

const ICONS: Record<string, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
  warning: 'warning',
}

export const ToastViewport: FunctionalComponent = () => {
  const { toasts, dismiss } = useToast()
  return (
    <div className="toast-viewport">
      {toasts.map((t) => (
        <div key={t.id} className={clsx('toast', `toast-${t.type}`)} onClick={() => dismiss(t.id)}>
          <span className="material-symbols-outlined toast-icon">{ICONS[t.type]}</span>
          <div className="toast-content">
            <p className="toast-title">{t.title}</p>
            {t.description && <p className="toast-desc">{t.description}</p>}
          </div>
          <button className="toast-close" onClick={() => dismiss(t.id)} type="button">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      ))}
    </div>
  )
}
