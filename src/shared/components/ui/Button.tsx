import { FunctionalComponent } from 'preact'
import { clsx } from '../../utils/clsx'
import { Icon } from './Icon'

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface Props {
  variant?: Variant
  size?: Size
  loading?: boolean
  block?: boolean
  icon?: string
  iconOnly?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
  onClick?: (e: MouseEvent) => void
  title?: string
  children?: any
}

export const Button: FunctionalComponent<Props> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  icon,
  iconOnly = false,
  type = 'button',
  disabled,
  className,
  onClick,
  title,
  children,
}) => (
  <button
    type={type}
    className={clsx('btn', `btn-${variant}`, `btn-${size}`, block && 'btn-block', iconOnly && 'btn-icon-only', className)}
    disabled={disabled || loading}
    onClick={onClick}
    title={title}
  >
    {loading && <span className="spinner spinner-sm" />}
    {!loading && icon && <Icon name={icon} className="btn-icon" />}
    {!iconOnly && children}
  </button>
)
