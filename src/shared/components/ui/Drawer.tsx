import { FunctionalComponent, Fragment } from 'preact'
import { useEffect } from 'preact/hooks'
import { clsx } from '../../utils/clsx'
import { Icon } from './Icon'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children?: any
  side?: 'right' | 'left'
  size?: 'md' | 'lg'
  className?: string
}

export const Drawer: FunctionalComponent<Props> = ({ open, onClose, title, children, side = 'right', size = 'md', className }) => {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <Fragment>
      <div className="modal-backdrop" onClick={onClose} />
      <div className={clsx('drawer', `drawer-${side}`, size === 'lg' && 'drawer-lg', className)} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3 className="modal-title">{title}</h3>
          <button className="icon-btn" onClick={onClose} type="button" aria-label="إغلاق اللوحة" title="إغلاق">
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </Fragment>
  )
}
