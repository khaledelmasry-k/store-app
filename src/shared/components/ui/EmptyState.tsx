import { FunctionalComponent } from 'preact'
import { Icon } from './Icon'

interface Props {
  icon?: string
  title?: string
  description?: string
  action?: any
  variant?: 'default' | 'list' | 'card' | 'inline'
}

export const EmptyState: FunctionalComponent<Props> = ({ icon = 'inbox', title = 'لا توجد بيانات', description, action, variant = 'default' }) => (
  <div className={`empty-state empty-state--${variant}`}>
    <div className="empty-icon">
      <Icon name={icon} />
    </div>
    <h3 className="empty-title">{title}</h3>
    {description && <p className="empty-desc">{description}</p>}
    {action && <div className="empty-action">{action}</div>}
  </div>
)
