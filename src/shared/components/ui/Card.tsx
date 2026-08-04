import { FunctionalComponent } from 'preact'
import { clsx } from '../../utils/clsx'

interface Props {
  title?: string
  subtitle?: string
  actions?: any
  className?: string
  children?: any
}

export const Card: FunctionalComponent<Props> = ({ title, subtitle, actions, className, children }) => (
  <div className={clsx('card', className)}>
    {(title || actions) && (
      <div className="card-head">
        <div>
          {title && <h3 className="card-title">{title}</h3>}
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="card-actions">{actions}</div>}
      </div>
    )}
    <div className="card-body">{children}</div>
  </div>
)
