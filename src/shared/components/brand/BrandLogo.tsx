import { FunctionalComponent } from 'preact'
import logoLight from '../../../assets/brand/matjari-logo-light.png'
import logoDark from '../../../assets/brand/matjari-logo-dark.png'
import './BrandMark.css'

interface Props {
  className?: string
  /** Surface behind the logo. `auto` follows the active app theme. */
  surface?: 'auto' | 'light' | 'dark' | 'brand'
}

/** Full bilingual Matjari wordmark extracted from the approved brand references. */
export const BrandLogo: FunctionalComponent<Props> = ({ className = '', surface = 'auto' }) => (
  <span
    className={`brand-logo brand-logo--surface-${surface}${className ? ` ${className}` : ''}`}
    role="img"
    aria-label="Matjari — متجري"
  >
    <img className="brand-logo-image brand-logo-image-light" src={logoLight} alt="" aria-hidden="true" />
    <img className="brand-logo-image brand-logo-image-dark" src={logoDark} alt="" aria-hidden="true" />
  </span>
)

export default BrandLogo
