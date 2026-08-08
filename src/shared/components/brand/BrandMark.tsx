import { FunctionalComponent } from 'preact'

// Canonical M&K brand mark — an "MK" monogram in the brand gradient box.
// Mirrors the AppShell sidebar mark so every surface shares one identity.
export const BrandMark: FunctionalComponent<{ small?: boolean; className?: string }> = ({ small, className = '' }) => (
  <span className={`brand-mark${small ? ' brand-mark-sm' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true">
    MK
  </span>
)

export default BrandMark
