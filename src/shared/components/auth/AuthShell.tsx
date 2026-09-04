import { FunctionalComponent } from 'preact'
import { BrandLogo } from '../brand/BrandLogo'
import { Icon } from '../ui/Icon'
import { AuthTopBar } from './AuthTopBar'
import authCommerceVisual from '../../../assets/brand/matjari-auth-commerce-v1.png'
import './AuthShell.css'

interface AuthShellProps {
  children: any
  variant?: 'skeleton' | 'brand'
}

function SkeletonPanel() {
  return (
    <div className="auth-panel-body" aria-hidden="true">
      <img className="auth-panel-visual" src={authCommerceVisual} alt="" />
    </div>
  )
}

function BrandPanel() {
  return (
    <div className="auth-brand-anchor" aria-hidden="true">
      <img className="auth-panel-visual" src={authCommerceVisual} alt="" />
      <Icon name="storefront" className="auth-brand-icon" ariaHidden />
      <h1>ابدأ رحلة نمو متجرك اليوم</h1>
      <p>أنشئ حسابك في دقائق وادخل إلى لوحة تحكم متجرك</p>
      <ul>
        <li>
          <Icon name="check" ariaHidden />
          لوحة تحكم ذكية
        </li>
        <li>
          <Icon name="check" ariaHidden />
          تقارير لحظية
        </li>
      </ul>
    </div>
  )
}

export const AuthShell: FunctionalComponent<AuthShellProps> = ({ children, variant = 'skeleton' }) => (
  <div className="auth-screen auth-console">
    <AuthTopBar />
    <div className="auth-split">
      <main className="auth-main">{children}</main>
      <aside className={`auth-panel${variant === 'brand' ? ' auth-panel--brand' : ''}`}>
        <div className="auth-panel-top">
          <BrandLogo className="auth-panel-logo" surface={variant === 'brand' ? 'brand' : 'auto'} />
        </div>
        {variant === 'brand' ? <BrandPanel /> : <SkeletonPanel />}
      </aside>
    </div>
    <footer className="auth-footer">
      <div className="auth-footer-inner">
        <span>© {new Date().getFullYear()} Matjari — متجري</span>
        <nav className="auth-footer-links" aria-label="روابط إضافية">
          <a href="/privacy">الخصوصية</a>
          <a href="/terms">الشروط</a>
          <a href="/contact">تواصل معنا</a>
        </nav>
      </div>
    </footer>
  </div>
)

export default AuthShell
