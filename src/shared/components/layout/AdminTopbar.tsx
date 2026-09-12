import { FunctionalComponent } from 'preact'

export interface AdminTopbarProps {
  children?: any
  className?: string
}

/** Shared topbar boundary; role-specific identity/actions are supplied by AdminShell. */
export const AdminTopbar: FunctionalComponent<AdminTopbarProps> = ({ children, className = '' }) => (
  <header className={`topbar console-topbar ${className}`}>{children}</header>
)
