import { FunctionalComponent } from 'preact'
import { BrandMark } from '../brand/BrandMark'
import { Icon } from '../ui/Icon'

// Landing-matched split-screen shell for the auth pages: a branded gradient
// panel with the core value props on one side and the auth card on the other.
// The panel collapses to a compact brand bar on narrow viewports.

const HIGHLIGHTS = [
  { icon: 'storefront', label: 'متجر إلكتروني كامل' },
  { icon: 'receipt_long', label: 'إدارة الطلبات والمخزون' },
  { icon: 'groups', label: 'سجل عملاء ومتابعة' },
  { icon: 'query_stats', label: 'تقارير ومبيعات لحظية' },
  { icon: 'link', label: 'روابط بيع قابلة للتتبع' },
]

export const AuthShell: FunctionalComponent<{ children: any }> = ({ children }) => (
  <div className="auth-screen auth-split">
    <aside className="auth-panel">
      <div className="auth-panel-top">
        <BrandMark small />
        <strong>M&amp;K Store</strong>
      </div>

      <div className="auth-panel-body">
        <span className="auth-panel-eyebrow">منصة التجارة الإلكترونية المتكاملة</span>
        <h2>أدر متجرك ومبيعاتك من مكان واحد</h2>
        <p>
          إدارة المنتجات والطلبات والعملاء والمخزون والمبيعات — كل شيء في لوحة واحدة
          بسيطة وآمنة.
        </p>
        <ul className="auth-panel-list">
          {HIGHLIGHTS.map((h) => (
            <li key={h.label}>
              <Icon name={h.icon} ariaHidden />
              <span>{h.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="auth-panel-foot">© {new Date().getFullYear()} M&amp;K Store</p>
    </aside>

    <main className="auth-main">{children}</main>
  </div>
)

export default AuthShell
