import { FunctionalComponent } from 'preact'
import iconLight from '../../../assets/brand/matjari-icon-light.png'
import iconDark from '../../../assets/brand/matjari-icon-dark.png'
import './BrandMark.css'

interface Props {
  small?: boolean
  className?: string
  surface?: 'auto' | 'light' | 'dark' | 'brand'
}

/** Compact Matjari mark shared by the app shell and dense UI surfaces. */
export const BrandMark: FunctionalComponent<Props> = ({ small, className = '', surface = 'auto' }) => (
  <span className={`brand-mark brand-mark--surface-${surface}${small ? ' brand-mark-sm' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true">
    <img className="brand-mark-image brand-mark-image-light" src={iconLight} alt="" />
    <img className="brand-mark-image brand-mark-image-dark" src={iconDark} alt="" />
  </span>
)

export default BrandMark
