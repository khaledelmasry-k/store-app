import { FunctionalComponent } from 'preact'
import { BrandMark } from '../brand/BrandMark'
import { Icon } from '../ui/Icon'
import { AuthTopBar } from './AuthTopBar'

const HIGHLIGHTS = [
  { icon: 'storefront', label: 'متجر عربي جاهز للبيع' },
  { icon: 'receipt_long', label: 'طلبات ومخزون في مكان واحد' },
  { icon: 'trending_up', label: 'ربحية حقيقية عند توفر التكلفة' },
  { icon: 'workspace_premium', label: 'خطط وحدود واضحة' },
  { icon: 'link', label: 'روابط بيع قابلة للتتبع' },
]

export const AuthShell: FunctionalComponent<{ children: any }> = ({ children }) => (
  <div className="auth-screen">
    <AuthTopBar />
    <div className="auth-split">
      <aside className="auth-panel">
      <div className="auth-panel-top">
        <BrandMark small />
        <strong>M&amp;K Store</strong>
      </div>

      <div className="auth-panel-body">
        <span className="auth-panel-eyebrow">نظام تشغيل التجارة العربية</span>
        <h2>ادخل إلى مركز قيادة متجرك</h2>
        <p>
          نفس الحساب يدير المتجر، الطلبات، المنتجات، العملاء، الاشتراك، والأرباح بدون تبديل أدوات أو نسخ بيانات.
        </p>
        <div className="auth-product-mini" aria-hidden="true">
          <div>
            <span>طلبات اليوم</span>
            <strong>24</strong>
          </div>
          <div>
            <span>الربح</span>
            <strong>493 ج.م</strong>
          </div>
          <div>
            <span>الخطة</span>
            <strong>GROWTH</strong>
          </div>
        </div>
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
  </div>
)

export default AuthShell
