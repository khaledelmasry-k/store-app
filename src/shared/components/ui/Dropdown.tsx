import { FunctionalComponent, Fragment } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { clsx } from '../../utils/clsx'
import { Icon } from './Icon'

interface Item {
  label?: string
  onClick?: () => void
  danger?: boolean
  icon?: string
  divider?: boolean
}

interface Props {
  trigger: any
  items: Item[]
  align?: 'left' | 'right'
}

export const Dropdown: FunctionalComponent<Props> = ({ trigger, items, align = 'left' }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="dropdown" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div className={clsx('dropdown-menu', `dropdown-${align}`)}>
          {items.map((item, i) => (
            <Fragment key={i}>
              {item.divider && <div className="dropdown-divider" />}
              <button
                type="button"
                className={clsx('dropdown-item', item.danger && 'dropdown-danger')}
                onClick={() => {
                  setOpen(false)
                  item.onClick?.()
                }}
              >
                {item.icon && <Icon name={item.icon} />}
                {item.label}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
