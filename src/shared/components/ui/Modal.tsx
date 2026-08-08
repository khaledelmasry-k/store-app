import { FunctionalComponent, Fragment } from 'preact'
import { useEffect } from 'preact/hooks'
import { clsx } from '../../utils/clsx'
import { Icon } from './Icon'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md' | 'lg'
  children?: any
  footer?: any
}

export const Modal: FunctionalComponent<Props> = ({ open, onClose, title, size = 'md', children, footer }) => {
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
      <div className={clsx('modal', `modal-${size}`)} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3 className="modal-title">{title}</h3>
          <button className="icon-btn" onClick={onClose} type="button">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </Fragment>
  )
}
