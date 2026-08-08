import { FunctionalComponent } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { Button } from '../../shared/components/ui/Button'
import { BrandMark } from '../../shared/components/brand/BrandMark'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatCurrency } from '../../shared/utils/format'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import type { SubscriptionPlan } from '../../shared/types'
import './LandingPage.css'
import { Icon } from '../../shared/components/ui/Icon'

const NAV_LINKS = [
  { href: '#features', label: 'المميزات' },
  { href: '#how-it-works', label: 'كيف تعمل' },
  { href: '#sales-links', label: 'روابط البيع' },
  { href: '#pricing', label: 'الأسعار' },
  { href: '#faq', label: 'الأسئلة الشائعة' },
]

type FvKind = 'products' | 'orders' | 'customers' | 'inventory' | 'analytics' | 'sales' | 'team' | 'storefront'

const FEATURES: { icon: string; title: string; desc: string; visual: FvKind }[] = [
  { icon: 'inventory_2', title: 'إدارة المنتجات', desc: 'أضف منتجاتك مع الصور والمتغيرات والأسعار، وحدّثها بسهولة ليبقى متجرك محدثاً دائماً.', visual: 'products' },
  { icon: 'receipt_long', title: 'إدارة الطلبات', desc: 'تابع الطلبات من لحظة وصولها حتى التسليم، وحدّث الحالة بنقرة واحدة ليصل العميل لما طلب.', visual: 'orders' },
  { icon: 'groups_2', title: 'إدارة العملاء', desc: 'احتفظ بسجل كامل لعملائك وتاريخ مشترياتهم، وأرسل لهم بثقة أكبر في كل مرة.', visual: 'customers' },
  { icon: 'inventory', title: 'إدارة المخزون', desc: 'راقب مستويات المخزون وتلقّ تنبيهات عند النفاد حتى لا تفوتك أي عملية بيع.', visual: 'inventory' },
  { icon: 'analytics', title: 'التقارير والتحليلات', desc: 'اعرف إيراداتك وطلباتك وأداء متجرك في لوحة واحدة، واتخذ قرارات مبنية على أرقام حقيقية.', visual: 'analytics' },
  { icon: 'link', title: 'روابط البيع', desc: 'أنشئ رابط تتبع فريداً لكل بائع أو مسوّق واعرف بالضبط من جلب لك كل عملية بيع.', visual: 'sales' },
  { icon: 'group_add', title: 'فريق العمل', desc: 'أضف أعضاء فريقك مع صلاحيات محددة لكل عضو، واسمح لكل شخص بإدارة مهامه بدقة.', visual: 'team' },
  { icon: 'store', title: 'إدارة المتاجر', desc: 'أدر هوية متجرك ورابطه وعملتك وإعداداته من مكان واحد، واجعل متجرك يعبّر عن علامتك التجارية.', visual: 'storefront' },
]

const STEPS = [
  { num: '01', title: 'أنشئ حسابك', desc: 'سجّل في دقائق بدون أي خبرة تقنية وابدأ رحلتك.' },
  { num: '02', title: 'اختر خطتك', desc: 'اختر الباقة المناسبة لمرحلة نمو متجرك.' },
  { num: '03', title: 'أنشئ متجرك وأضف منتجاتك', desc: 'خصص اسم متجرك ورابطه، وأضف منتجاتك بسهولة.' },
  { num: '04', title: 'ابدأ البيع وتابع النتائج', desc: 'استقبل الطلبات، أدر مبيعاتك، وتابع أداء متجرك في الوقت الحقيقي.' },
]

const SALES_LINK_STEPS = [
  { icon: 'add_link', title: 'أنشئ رابطاً لكل بائع', desc: 'اربط كل بائع أو مسوّق برابط فريد يخصه وحده.' },
  { icon: 'share', title: 'شاركه في أي مكان', desc: 'ينشر البائع رابطك على واتساب أو تيك توك أو أي قناة يحبها.' },
  { icon: 'shopping_cart', title: 'يصل العميل ويشتري', desc: 'يدخل العميل عبر الرابط ويتم تسجيل الزيارة تلقائياً.' },
  { icon: 'query_stats', title: 'تابع النتائج', desc: 'تعرف عدد الزيارات والطلبات والإيرادات لكل بائع بدقة.' },
]

const FAQS = [
  { q: 'هل أحتاج إلى خبرة تقنية؟', a: 'لا، المنصة مصممة لتكون سهلة الاستخدام ولا تتطلب أي معرفة تقنية. يمكنك إنشاء متجرك وإضافة منتجاتك وإدارة طلباتك من لوحة تحكم بسيطة وواضحة.' },
  { q: 'كيف تبدأ الطلبات بالوصول إلي؟', a: 'بعد إنشاء متجرك وإضافة منتجاتك، يمكن للعملاء زيارة رابط متجرك والبدء في الشراء مباشرة، وتصلك الطلبات فوراً في لوحة التحكم لتتمكن من إدارتها.' },
  { q: 'هل يمكنني إضافة فريق عمل؟', a: 'نعم، يمكنك دعوة أعضاء فريقك وتحديد صلاحيات كل عضو، بحيث يدير كلٌّ مسؤولياته (مثل المنتجات أو المبيعات) ضمن نطاق محدد وآمن.' },
  { q: 'ما هي روابط البيع وهل أستطيع متابعة أداء كل بائع؟', a: 'روابط البيع تتيح لك إنشاء رابط تتبع فريد لكل بائع أو مسوّق. تحصل على أرقام دقيقة لكل رابط (الزيارات والطلبات والمبيعات) لتعرف من يحقق أفضل أداء.' },
  { q: 'هل يمكنني إدارة أكثر من متجر؟', a: 'حالياً يدير كل حساب متجراً خاصاً به من لوحة تحكم واحدة. دعم إدارة أكثر من متجر هو ضمن خطة تطوير قادمة وسيُعلن عنه عند إطلاقه.' },
  { q: 'كيف تعمل الاشتراكات؟', a: 'تختار الباقة المناسبة عند التسجيل ويتم تدوين اشتراكك، ثم تراجع منصة M&#38;K Store الطلب وتفعّل حسابك ومتجرك. جميع بياناتك آمنة ومعزولة تماماً.' },
]

const NAV_SIDEBAR_ICONS = ['space_dashboard', 'inventory_2', 'receipt_long', 'groups', 'query_stats', 'link', 'settings']

const DM_ORDERS = [
  { n: 'ORD-0001', c: 'جديد', t: 'blue' },
  { n: 'ORD-0002', c: 'تم الشحن', t: 'amber' },
  { n: 'ORD-0003', c: 'تم التسليم', t: 'green' },
]

const SALES_METRICS = [
  { label: 'الزيارات', value: '12,480', icon: 'visibility' },
  { label: 'الطلبات', value: '1,203', icon: 'receipt_long' },
  { label: 'المبيعات', value: '2,940,000', icon: 'payments', hint: 'ر.س' },
  { label: 'نسبة التحويل', value: '9.6%', icon: 'trending_up' },
]

// Lightweight, decorative feature visuals — CSS compositions built from the
// real M&K design tokens. They are pure UI representations (aria-hidden) and
// never claim to show real platform metrics.
function FeatureVisual({ kind }: { kind: FvKind }) {
  if (kind === 'products') {
    return (
      <div className="fv fv-products" aria-hidden="true">
        {[
          ['#6366f1', '#8b5cf6'],
          ['#0ea5e9', '#38bdf8'],
          ['#16a34a', '#4ade80'],
        ].map((g, i) => (
          <div className="fv-product" key={i}>
            <span className="fv-thumb" style={{ background: `linear-gradient(135deg, ${g[0]}, ${g[1]})` }} />
            <span className="fv-line" />
            <span className="fv-line fv-line-short" />
            <span className="fv-price">{formatCurrency([240, 320, 550][i])}</span>
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'orders') {
    return (
      <div className="fv fv-orders" aria-hidden="true">
        {DM_ORDERS.map((o, i) => (
          <div className="fv-order" key={i}>
            <span className="fv-order-num">{o.n}</span>
            <span className="fv-line fv-line-grow" />
            <span className={`fv-chip fv-chip-${o.t}`}>{o.c}</span>
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'customers') {
    const rows = [
      ['م', 'محمد أحمد', 'عميل دائم', '#8b5cf6'],
      ['س', 'سارة علي', 'عميل جديد', '#0ea5e9'],
      ['ك', 'كريم حسن', 'عميل جديد', '#16a34a'],
    ]
    return (
      <div className="fv fv-customers" aria-hidden="true">
        {rows.map((r, i) => (
          <div className="fv-cust" key={i}>
            <span className="fv-avatar" style={{ background: r[3] }}>{r[0]}</span>
            <div className="fv-cust-mid">
              <span className="fv-line fv-line-grow" style={{ width: `${58 - i * 6}%` }} />
              <span className="fv-line fv-line-sm" style={{ width: '34%' }} />
            </div>
            <span className={`fv-chip ${i === 0 ? 'fv-chip-violet' : 'fv-chip-blue'}`}>{r[2]}</span>
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'inventory') {
    const rows = [
      ['مخزون كافٍ', '82%', 'green'],
      ['مخزون منخفض', '38%', 'amber'],
      ['قارب على النفاد', '12%', 'red'],
    ]
    return (
      <div className="fv fv-inventory" aria-hidden="true">
        {rows.map((r, i) => (
          <div className="fv-inv-row" key={i}>
            <span className="fv-line fv-line-grow" style={{ width: '40%' }} />
            <span className="fv-inv-track"><span className={`fv-inv-fill fv-inv-fill-${r[2]}`} style={{ width: r[1] }} /></span>
            <span className={`fv-chip fv-chip-${r[2]}`}>{r[0]}</span>
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'analytics') {
    return (
      <div className="fv fv-analytics" aria-hidden="true">
        <div className="fv-bars">
          {[...Array(12)].map((_, i) => (
            <span key={i} className="fv-bar" style={{ height: `${18 + ((i * 37) % 62)}%` }} />
          ))}
        </div>
        <div className="fv-minikpis">
          <span className="fv-mini"><i className="fv-dot fv-dot-green" />مبيعات</span>
          <span className="fv-mini"><i className="fv-dot fv-dot-blue" />طلبات</span>
          <span className="fv-mini"><i className="fv-dot fv-dot-violet" />عملاء جدد</span>
        </div>
      </div>
    )
  }
  if (kind === 'sales') {
    const rows = [
      ['رابط أحمد', 'facebook', 'whatsapp'],
      ['رابط أحمد', 'whatsapp', 'instagram'],
      ['رابط نور', 'tiktok', 'tiktok'],
    ]
    return (
      <div className="fv fv-sales" aria-hidden="true">
        {rows.map((r, i) => (
          <div className="fv-sale" key={i}>
            <span className="fv-link-chip"><Icon name="link" />{r[0]} · {r[1]}</span>
            <span className="fv-line fv-line-sm" style={{ width: `${30 + i * 8}%` }} />
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'team') {
    const rows = [
      ['ن', 'نور', 'violet', ['منتجات', 'طلبات']],
      ['م', 'منى', 'blue', ['طلبات', 'عملاء']],
      ['ع', 'عمر', 'green', ['مخزون']],
    ]
    return (
      <div className="fv fv-team" aria-hidden="true">
        {rows.map((r, i) => (
          <div className="fv-member" key={i}>
            <span className={`fv-avatar fv-avatar-${r[2]}`}>{r[0]}</span>
            <div className="fv-cust-mid">
              <span className="fv-line fv-line-grow" style={{ width: '42%' }} />
              <span className="fv-perms">
                {(r[3] as string[]).map((p, j) => (
                  <span key={j} className="fv-chip fv-chip-slate">{p}</span>
                ))}
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="fv fv-storefront" aria-hidden="true">
      <div className="fv-store-head">
        <span className="fv-thumb fv-thumb-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }} />
        <div className="fv-cust-mid">
          <span className="fv-line fv-line-grow" style={{ width: '52%' }} />
          <span className="fv-line fv-line-sm" style={{ width: '62%' }} />
        </div>
        <span className="fv-chip fv-chip-green">منشور</span>
      </div>
      <div className="fv-store-items">
        {['#eef2ff', '#ecfeff', '#ecfdf5'].map((c, i) => (
          <span key={i} className="fv-store-item" style={{ background: c }} />
        ))}
      </div>
    </div>
  )
}

export const LandingPage: FunctionalComponent = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const plansRes = useCollection<SubscriptionPlan>('plans', { orderBy: { field: 'priceMonthly' } })
  const plans = useMemo(() => plansRes.data.filter((p) => p.active !== false), [plansRes.data])

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'))
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('in-view'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in-view')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.12 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const toggleFaq = (i: number) => setOpenFaq(openFaq === i ? null : i)

  const goToAnchor = (href: string) => (e: MouseEvent) => {
    if (href.startsWith('#')) {
      e.preventDefault()
      const el = document.getElementById(href.slice(1))
      if (el) {
        const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      }
    }
    setMenuOpen(false)
  }

  return (
    <div className="landing" dir="rtl">
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <a href="/" className="landing-brand">
            <BrandMark small />
            <span>M&amp;K Store</span>
          </a>

          <button
            type="button"
            className="landing-menu-toggle"
            aria-label="القائمة"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>

          <nav className={`landing-nav${menuOpen ? ' open' : ''}`} aria-label="التنقل الرئيسي">
            <a href="/" className="landing-nav-link" onClick={() => setMenuOpen(false)}>الرئيسية</a>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={goToAnchor(l.href)} className="landing-nav-link">{l.label}</a>
            ))}
            <div className="landing-nav-actions">
              <Link href="/login" className="landing-nav-btn landing-nav-btn-ghost">تسجيل الدخول</Link>
              <Link href="/register" className="landing-nav-btn landing-nav-btn-primary">ابدأ مجاناً</Link>
            </div>
          </nav>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-container">
            <div className="hero-grid">
              <div className="hero-content reveal">
                <span className="hero-eyebrow">منصة التجارة الإلكترونية المتكاملة</span>
                <h1>أنشئ متجرك الإلكتروني وأدر مبيعاتك من مكان واحد</h1>
                <p>
                  منصة M&amp;K Store تمنحك الأدوات التي تحتاجها لإدارة المنتجات والطلبات والعملاء والمخزون
                  والمبيعات، بدون تعقيد.
                </p>
                <div className="hero-actions">
                  <Link href="/register">
                    <Button size="lg" icon="rocket_launch">ابدأ متجرك الآن</Button>
                  </Link>
                  <a href="#features" className="hero-cta-secondary" onClick={goToAnchor('#features')}>
                    <Button size="lg" variant="secondary" icon="visibility">استكشف المنصة</Button>
                  </a>
                </div>
                <div className="hero-trust">
                  <Icon name="verified_user" ariaHidden />
                  متجر، لوحة تحكم، وروابط بيع — كل شيء في مكان واحد
                </div>
              </div>

              <div className="hero-visual reveal" aria-hidden="true">
                <div className="dash-mockup">
                  <div className="dash-mockup-side">
                    <span className="dm-brand">MK</span>
                    {NAV_SIDEBAR_ICONS.map((ic) => (
                      <span key={ic} className="dm-nav-item"><Icon name={ic} /></span>
                    ))}
                  </div>
                  <div className="dash-mockup-main">
                    <div className="dm-topbar">
                      <span className="dm-store"><span className="dm-store-dot" />بيت الشاي</span>
                      <span className="dm-url">beit-el-shay.store</span>
                    </div>
                    <div className="dm-kpis">
                      {['طلبات اليوم', 'مبيعات اليوم', 'المنتجات', 'العملاء'].map((k) => (
                        <div className="dm-kpi" key={k}>
                          <span className="dm-kpi-label">{k}</span>
                          <span className="dm-kpi-bar" />
                        </div>
                      ))}
                    </div>
                    <div className="dm-chart">
                      {[...Array(12)].map((_, i) => (
                        <span key={i} className="dm-chart-bar" style={{ height: `${18 + ((i * 37) % 60)}%` }} />
                      ))}
                    </div>
                    <div className="dm-orders">
                      {DM_ORDERS.map((o, i) => (
                        <div className="dm-order" key={i}>
                          <span className="dm-order-num">{o.n}</span>
                          <span className="dm-order-line" />
                          <span className={`dm-chip dm-chip-${o.t}`}>{o.c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="dm-float dm-float-store">
                    <span className="dm-float-thumb" style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' }} />
                    <div className="dm-float-mid">
                      <span className="dm-float-line" />
                      <span className="dm-float-line dm-float-line-sm" />
                    </div>
                    <span className="dm-float-price">ج.م 320</span>
                  </div>
                  <span className="dm-float dm-float-chip dm-chip-green">طلب جديد</span>
                </div>
                <p className="hero-preview-caption">لقطة تمثيلية من لوحة تحكم M&amp;K Store</p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-trust-strip" aria-label="مزايا أساسية">
          <div className="landing-container trust-strip-inner">
            {[
              { icon: 'storefront', label: 'متجرك' },
              { icon: 'receipt_long', label: 'طلباتك' },
              { icon: 'groups', label: 'عملاؤك' },
              { icon: 'group_add', label: 'فريقك' },
              { icon: 'query_stats', label: 'مبيعاتك' },
            ].map((t) => (
              <div className="trust-strip-item" key={t.label}>
                <Icon name={t.icon} ariaHidden />
                <span>{t.label}</span>
              </div>
            ))}
            <p className="trust-strip-tagline">كل ذلك في منصة واحدة</p>
          </div>
        </section>

        <section id="features" className="landing-section landing-section-soft">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="section-eyebrow">المميزات</span>
              <h2>كل ما تحتاجه لإدارة متجرك</h2>
              <p className="section-subtitle">أدوات متكاملة صُممت لتنمي مبيعاتك وتوفر عليك الوقت والجهد.</p>
            </div>
            <div className="features-grid">
              {FEATURES.map((f) => (
                <div className="feature-card lp-card reveal" key={f.title}>
                  <div className="feature-visual">
                    <FeatureVisual kind={f.visual} />
                  </div>
                  <div className="feature-body">
                    <span className="feature-icon"><Icon name={f.icon} ariaHidden /></span>
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="landing-section">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="section-eyebrow">كيف تعمل</span>
              <h2>ابدأ في أربع خطوات بسيطة</h2>
              <p className="section-subtitle">من التسجيل إلى أول عملية بيع — أسرع مما تتوقع.</p>
            </div>
            <div className="steps-grid">
              {STEPS.map((s) => (
                <div className="step-item lp-card reveal" key={s.num}>
                  <span className="step-indicator" aria-hidden="true">{s.num}</span>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section-soft landing-showcase">
          <div className="landing-container">
            <div className="showcase-grid">
              <div className="reveal">
                <span className="section-eyebrow">لوحة تحكم احترافية</span>
                <h2>تحكّم كامل في متجرك من مكان واحد</h2>
                <p>
                  المبيعات، الطلبات، المخزون، العملاء، والتقارير — كلها في لوحة واحدة مصممة لتكون واضحة
                  وسريعة. لا صفحات مبعثرة، ولا أدوات معقدة.
                </p>
                <ul className="showcase-list">
                  <li><Icon name="check_circle" ariaHidden />مؤشرات أداء حقيقية فور الطلب</li>
                  <li><Icon name="check_circle" ariaHidden />تنبيهات مخزون تلقائية</li>
                  <li><Icon name="check_circle" ariaHidden />تقارير ورسوم بيانية فورية</li>
                  <li><Icon name="check_circle" ariaHidden />صلاحيات دقيقة لفريق العمل</li>
                </ul>
              </div>
              <div className="showcase-visual reveal">
                <div className="stat-cards-grid">
                  {['المبيعات', 'الطلبات', 'المنتجات', 'العملاء'].map((label) => (
                    <div className="stat-card lp-card" key={label}>
                      <span className="stat-card-label">{label}</span>
                      <span className="stat-card-line" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="sales-links" className="landing-section landing-sales-links">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="section-eyebrow">روابط البيع</span>
              <h2>خلّي كل عملية بيع قابلة للتتبع</h2>
              <p className="section-subtitle">
                أنشئ لكل بائع أو مسوّق رابطاً خاصاً به، واعرف من أين جاءت طلباتك ومن يحقق أفضل أداء — بدون
                أي حسابات يدوية.
              </p>
            </div>
            <div className="sales-steps-grid">
              {SALES_LINK_STEPS.map((s) => (
                <div className="sales-step-card lp-card reveal" key={s.title}>
                  <span className="sales-step-icon"><Icon name={s.icon} ariaHidden /></span>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="sales-links-note">
              بائع واحد، عدة قنوات: أحمد / Facebook، أحمد / WhatsApp، أحمد / TikTok — كل رابط بأرقامه الخاصة.
            </p>
            <div className="sales-metrics">
              {SALES_METRICS.map((m) => (
                <div className="sales-metric lp-card" key={m.label}>
                  <span className="sales-metric-icon"><Icon name={m.icon} ariaHidden /></span>
                  <div className="sales-metric-text">
                    <span className="sales-metric-value">{m.value}{m.hint ? <small>{m.hint}</small> : null}</span>
                    <span className="sales-metric-label">{m.label}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="sales-metrics-demo">
              <span className="demo-tag">عرض توضيحي</span>
              الأرقام أعلاه مثال من واجهة روابط البيع لتوضيح شكل التقرير — وليست إحصائيات فعلية.
            </p>
          </div>
        </section>

        <section id="pricing" className="landing-section landing-section-soft">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="section-eyebrow">الأسعار</span>
              <h2>اختر الخطة المناسبة لنمو متجرك</h2>
              <p className="section-subtitle">باقات مرنة تناسب كل مرحلة من مراحل نمو متجرك.</p>
            </div>
            {plans.length === 0 ? (
              <EmptyState
                icon="workspace_premium"
                title="الباقات قيد الإعداد"
                description="يتم حالياً إعداد خطط الاشتراك. سجّل الآن لتحصل على أول إشعار عند إطلاقها."
                action={<Link href="/register"><Button icon="rocket_launch">ابدأ متجرك الآن</Button></Link>}
              />
            ) : (
              <div className="pricing-grid">
                {plans.map((p, idx) => {
                  const isFeatured = idx === Math.floor(plans.length / 2)
                  return (
                    <div key={p.id} className={`pricing-card lp-card reveal${isFeatured ? ' pricing-featured' : ''}`}>
                      {isFeatured && <div className="pricing-badge">الأكثر شيوعاً</div>}
                      <h3>{p.name}</h3>
                      <p className="pricing-desc">{p.description || 'باقة مميزة لإدارة متجرك'}</p>
                      <div className="pricing-price">
                        <span className="pricing-amount">
                          {p.priceMonthly === 0 ? '0' : formatCurrency(p.priceMonthly)}
                        </span>
                        {p.priceMonthly > 0 && <span className="pricing-period">/شهرياً</span>}
                      </div>
                      <div className="pricing-limits-row">
                        {typeof p.productLimit === 'number' && p.productLimit > 0 && (
                          <p className="pricing-limits">حتى {p.productLimit} منتج</p>
                        )}
                        {typeof p.orderLimitPerMonth === 'number' && p.orderLimitPerMonth > 0 && (
                          <p className="pricing-limits">حتى {p.orderLimitPerMonth} طلب شهرياً</p>
                        )}
                      </div>
                      <ul className="pricing-features">
                        {(p.features || []).map((f, fi) => (
                          <li key={fi}><Icon name="check" ariaHidden />{f}</li>
                        ))}
                      </ul>
                      <Link href={`/register?plan=${p.id}`} className="pricing-cta">
                        <Button variant={isFeatured ? 'primary' : 'outline'} block icon="rocket_launch">
                          ابدأ الآن
                        </Button>
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section id="faq" className="landing-section">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="section-eyebrow">الأسئلة الشائعة</span>
              <h2>عندك سؤال؟ غالباً الجواب هنا</h2>
            </div>
            <div className="faq-list">
              {FAQS.map((faq, i) => {
                const open = openFaq === i
                return (
                  <div className={`faq-item${open ? ' open' : ''}`} key={i}>
                    <button
                      type="button"
                      className="faq-question"
                      onClick={() => toggleFaq(i)}
                      aria-expanded={open}
                      aria-controls={`faq-panel-${i}`}
                      id={`faq-button-${i}`}
                    >
                      <span>{faq.q}</span>
                      <Icon name="keyboard_arrow_down" className={`faq-icon${open ? ' rotate' : ''}`} ariaHidden />
                    </button>
                    <div
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-button-${i}`}
                      className="faq-answer"
                      hidden={!open}
                    >
                      <p>{faq.a}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <div className="landing-container">
            <h2>جاهز تبدأ البيع بشكل أكثر احترافية؟</h2>
            <p>أنشئ متجرك، أضف منتجاتك، وابدأ في استقبال الطلبات من مكان واحد.</p>
            <div className="cta-actions">
              <Link href="/register">
                <Button size="lg" icon="rocket_launch">ابدأ متجرك الآن</Button>
              </Link>
              <a href="#pricing" onClick={goToAnchor('#pricing')}>
                <Button size="lg" variant="secondary">تعرّف على الخطط</Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-grid">
            <div className="footer-brand">
              <BrandMark small />
              <div>
                <strong>M&amp;K Store</strong>
                <p>منصة متكاملة لإدارة متاجر التجارة الإلكترونية.</p>
              </div>
            </div>
            <div className="footer-col">
              <h4>المنتج</h4>
              <a href="#features" onClick={goToAnchor('#features')}>المميزات</a>
              <a href="#how-it-works" onClick={goToAnchor('#how-it-works')}>كيف تعمل</a>
              <a href="#pricing" onClick={goToAnchor('#pricing')}>الأسعار</a>
              <a href="#faq" onClick={goToAnchor('#faq')}>الأسئلة الشائعة</a>
            </div>
            <div className="footer-col">
              <h4>الحساب</h4>
              <a href="/login">تسجيل الدخول</a>
              <a href="/register">إنشاء حساب</a>
            </div>
            <div className="footer-col">
              <h4>الدعم</h4>
              <a href="#faq" onClick={goToAnchor('#faq')}>مركز المساعدة</a>
              <a href="/contact">تواصل معنا</a>
            </div>
            <div className="footer-col">
              <h4>قانوني</h4>
              <a href="/privacy">سياسة الخصوصية</a>
              <a href="/terms">شروط الاستخدام</a>
            </div>
          </div>
          <p className="footer-copy">© {new Date().getFullYear()} M&amp;K Store. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
