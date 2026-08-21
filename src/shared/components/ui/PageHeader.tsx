import { FunctionalComponent } from 'preact'

interface Props {
  title: string
  subtitle?: string
  actions?: any
  breadcrumb?: string
}

export const PageHeader: FunctionalComponent<Props> = ({ title, subtitle, actions, breadcrumb }) => (
  <div className="page-header">
    <div className="page-header-copy">
      {breadcrumb && <div className="breadcrumb">{breadcrumb}</div>}
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
)