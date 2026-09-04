import { FunctionalComponent } from 'preact'
import { clsx } from '../../utils/clsx'
import { Icon } from './Icon'

interface Props {
  title?: string
  subtitle?: string
  actions?: any
  className?: string
  children?: any
  titleIcon?: string
  titleIconTone?: 'primary' | 'secondary' | 'default'
}

export const Card: FunctionalComponent<Props> = ({ title, subtitle, actions, className, children, titleIcon, titleIconTone = 'primary' }) => (
  <div className={clsx('card', className)}>
    {(title || actions) && (
      <div className="card-head">
        <div className={clsx('card-head-text', titleIcon && 'card-head-with-icon')}>
          {titleIcon && <Icon name={titleIcon} className={`card-head-icon is-${titleIconTone}`} ariaHidden />}
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="card-actions">{actions}</div>}
      </div>
    )}
    <div className="card-body">{children}</div>
  </div>
)
