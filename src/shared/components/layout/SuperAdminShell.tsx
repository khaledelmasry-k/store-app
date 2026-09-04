import { FunctionalComponent } from 'preact'
import { AdminShell } from './AdminShell'
import './SuperAdminShell.css'

/** Platform chrome owner. Platform pages never render navigation themselves. */
export const SuperAdminShell: FunctionalComponent = ({ children }) => (
  <div className="platform-shell">
    <AdminShell role="superadmin" brand="Matjari">{children}</AdminShell>
  </div>
)
