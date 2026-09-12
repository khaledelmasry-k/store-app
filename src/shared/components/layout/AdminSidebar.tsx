import { FunctionalComponent } from 'preact'

export interface AdminSidebarProps {
  children?: any
  className?: string
  onMouseEnter?: () => void
  onMouseMove?: () => void
  onMouseLeave?: () => void
}

/** Shared chrome boundary for Merchant and SuperAdmin navigation. */
export const AdminSidebar: FunctionalComponent<AdminSidebarProps> = ({ children, className = '', onMouseEnter, onMouseMove, onMouseLeave }) => (
  <aside className={`sidebar console-sidebar ${className}`} id="sidebar" onMouseEnter={onMouseEnter} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
    {children}
  </aside>
)
