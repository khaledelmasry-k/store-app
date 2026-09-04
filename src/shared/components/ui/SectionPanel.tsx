import { FunctionalComponent } from 'preact'
import { Card } from './Card'

interface Props {
  title?: string
  subtitle?: string
  actions?: any
  className?: string
  children?: any
}

/** Shared neutral section surface for Merchant and SuperAdmin workspaces. */
export const SectionPanel: FunctionalComponent<Props> = ({ title, subtitle, actions, className, children }) => (
  <Card title={title} subtitle={subtitle} actions={actions} className={`section-panel${className ? ` ${className}` : ''}`}>
    {children}
  </Card>
)
