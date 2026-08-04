import { FunctionalComponent } from 'preact'
import { AppShell } from './AppShell'

export const PlatformLayout: FunctionalComponent = ({ children }) => (
  <AppShell navKey="platform" brand="منصة M&K">
    {children}
  </AppShell>
)
