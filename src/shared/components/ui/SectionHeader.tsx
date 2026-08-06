import { FunctionalComponent } from 'preact'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  actions?: any
}

export const SectionHeader: FunctionalComponent<SectionHeaderProps> = ({ title, subtitle, actions }) => (
  <div className="section-header">
    <div>
      <h2 className="section-title">{title}</h2>
      {subtitle && <p className="section-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="section-actions">{actions}</div>}
  </div>
)