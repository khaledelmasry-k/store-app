import { FunctionalComponent } from 'preact'

interface Props {
  title: string
  subtitle?: string
  actions?: any
  breadcrumb?: string
  eyebrow?: string
  context?: any
}

export const PageHeader: FunctionalComponent<Props> = ({ title, subtitle, actions, breadcrumb, eyebrow, context }) => (
  <div className="page-header">
    <div className="page-header-copy">
      {(eyebrow || breadcrumb) && <div className="page-eyebrow">{eyebrow || breadcrumb}</div>}
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    <div className="page-header-end">
      {context && <div className="page-context">{context}</div>}
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  </div>
)
