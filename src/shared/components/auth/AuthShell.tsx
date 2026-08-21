import { FunctionalComponent } from 'preact'
import { BrandMark } from '../brand/BrandMark'
import { Icon } from '../ui/Icon'
import { AuthTopBar } from './AuthTopBar'
import './AuthShell.css'

interface AuthShellProps {
  children: any
  variant?: 'skeleton' | 'brand'
}

const PANEL_KPIS = ['قيمة الإيرادات', 'عدد الطلبات']

const CHART_BARS = [42, 68, 55, 82, 60, 90, 72]

function SkeletonPanel() {
  return (
    <div className="auth-panel-body" aria-hidden="true">
      <div className="auth-skeleton-dash">
        <div className="auth-sk-topbar">
          <span className="auth-sk-dot" />
          <span className="auth-sk-bar auth-sk-w40" />
          <span className="auth-sk-avatar" />
        </div>
        <div className="auth-sk-kpis">
          {PANEL_KPIS.map((label) => (
            <div key={label} className="auth-kpi-tile">
              <span>{label}</span>
              <strong>—</strong>
            </div>
          ))}
        </div>
        <div className="auth-sk-chart">
          {CHART_BARS.map((h, i) => (
            <i key={i} className="auth-sk-bar" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="auth-float-row">
        <div className="auth-float-card">
          <span>الربح</span>
          <strong>—</strong>
          <div className="auth-progress">
            <i />
          </div>
        </div>
        <div className="auth-float-card">
          <span>عدد الطلبات</span>
          <strong>—</strong>
          <div className="auth-progress">
            <i style={{ width: '44%' }} />
          </div>
        </div>
      </div>
      <div className="auth-float-chip">
        <Icon name="storefront" ariaHidden />
        <span>لوحة تحكم متجرك</span>
      </div>
    </div>
  )
}

function BrandPanel() {
  return (
    <div className="auth-brand-anchor" aria-hidden="true">
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
          <BrandMark small />
          <strong>M&amp;K Store</strong>
        </div>
        {variant === 'brand' ? <BrandPanel /> : <SkeletonPanel />}
      </aside>
    </div>
    <footer className="auth-footer">
      <div className="auth-footer-inner">
        <span>© {new Date().getFullYear()} M&amp;K Store</span>
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