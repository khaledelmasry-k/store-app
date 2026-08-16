import { FunctionalComponent } from 'preact'
import { Icon } from '../../shared/components/ui/Icon'

interface HeaderProps {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: any
}

export const InternalPageHeader: FunctionalComponent<HeaderProps> = ({ eyebrow, title, subtitle, actions }) => (
  <header className="internal-page-header">
    <div className="internal-page-header-copy">
      {eyebrow && <span className="internal-page-eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {actions && <div className="internal-page-header-actions">{actions}</div>}
  </header>
)

interface SectionProps {
  title?: string
  subtitle?: string
  actions?: any
  className?: string
  children?: any
}

export const WorkspaceSection: FunctionalComponent<SectionProps> = ({ title, subtitle, actions, className = '', children }) => (
  <section className={`workspace-section ${className}`}>
    {(title || subtitle || actions) && (
      <div className="workspace-section-head">
        <div>
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="workspace-section-actions">{actions}</div>}
      </div>
    )}
    <div className="workspace-section-body">{children}</div>
  </section>
)

export const WorkspaceDivider: FunctionalComponent = () => <div className="workspace-divider" aria-hidden="true" />

export const WorkspaceEmptyMark: FunctionalComponent<{ icon?: string }> = ({ icon = 'inbox' }) => (
  <span className="workspace-empty-mark"><Icon name={icon} ariaHidden /></span>
)
