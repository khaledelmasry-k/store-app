import { FunctionalComponent } from 'preact'
import { AppShell } from './AppShell'

export interface AdminShellProps {
  role: 'merchant' | 'superadmin'
  brand: string
  brandLogo?: string
  children?: any
  storeSwitcher?: { storeIds: string[]; currentId: string; onSwitch: (id: string | null) => void }
  storefrontHref?: string
}

/** Single shared admin shell entry point for both role experiences. */
export const AdminShell: FunctionalComponent<AdminShellProps> = ({ role, brand, brandLogo, children, storeSwitcher, storefrontHref }) => (
  <AppShell navKey={role === 'merchant' ? 'dashboard' : 'platform'} brand={brand} brandLogo={brandLogo} storeSwitcher={storeSwitcher} storefrontHref={storefrontHref}>
    {children}
  </AppShell>
)
