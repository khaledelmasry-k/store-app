import { FunctionalComponent } from 'preact'

interface Props {
  icon?: string
  title?: string
  description?: string
  action?: any
}

export const EmptyState: FunctionalComponent<Props> = ({ icon = 'inbox', title = 'لا توجد بيانات', description, action }) => (
  <div className="empty-state">
    <div className="empty-icon">
      <span className="material-symbols-outlined">{icon}</span>
    </div>
    <h3 className="empty-title">{title}</h3>
    {description && <p className="empty-desc">{description}</p>}
    {action && <div className="empty-action">{action}</div>}
  </div>
)
