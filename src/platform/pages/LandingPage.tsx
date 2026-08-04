import { FunctionalComponent } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { Button } from '../../shared/components/ui/Button'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatCurrency } from '../../shared/utils/format'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import type { SubscriptionPlan } from '../../shared/types'
import './LandingPage.css'

const NAV_LINKS = [
  { href: '#features', label: 'المميزات' },
  { href: '#how-it-works', label: 'كيف تعمل' },
  { href: '#sales-links', label: 'روابط البيع' },
  { href: '#pricing', label: 'الأسعار' },
  { href: '#faq', label: 'الأسئلة الشائعة' },
]

const FEATURES = [
  { icon: 'inventory_2', title: 'إدارة المنتجات', desc: 'أضف منتجاتك مع الصور والمتغيرات والأسعار، وحدّثها بسهولة ليبقى متجرك محدثاً دائماً.' },
  { icon: 'receipt_long', title: 'إدارة الطلبات', desc: 'تابع الطلبات من لحظة وصولها حتى التسليم، وحدّث الحالة بنقرة واحدة ليصل العميل لما طلب.' },
  { icon: 'groups_2', title: 'إدارة العملاء', desc: 'احتفظ بسجل كامل لعملائك وتاريخ مشترياتهم، وأرسل لهم بثقة أكبر في كل مرة.' },
  { icon: 'inventory', title: 'إدارة المخزون', desc: 'راقب مستويات المخزون وتلقّ تنبيهات عند النفاد حتى لا تفوتك أي عملية بيع.' },
  { icon: 'analytics', title: 'التقارير والتحليلات', desc: 'اعرف إيراداتك وطلباتك وأداء متجرك في لوحة واحدة، واتخذ قرارات مبنية على أرقام حقيقية.' },
  { icon: 'link', title: 'روابط البيع', desc: 'أنشئ رابط تتبع فريداً لكل بائع أو مسوّق واعرف بالضبط من جلب لك كل عملية بيع.' },
  { icon: 'group_add', title: 'فريق العمل', desc: 'أضف أعضاء فريقك مع صلاحيات محددة لكل عضو، واسمح لكل شخص بإدارة مهامه بدقة.' },
  { icon: 'store', title: 'إدارة المتاجر', desc: 'أدر هوية متجرك ورابطه وعملتك وإعداداته من مكان واحد، واجعل متجرك يعبّر عن علامتك التجارية.' },
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

export const LandingPage: FunctionalComponent = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const plansRes = useCollection<SubscriptionPlan>('plans', { orderBy: { field: 'priceMonthly' } })
  const plans = useMemo(() => plansRes.data.filter((p) => p.active !== false), [plansRes.data])

  const toggleFaq = (i: number) => setOpenFaq(openFaq === i ? null : i)

  const goToAnchor = (href: string) => (e: MouseEvent) => {
    if (href.startsWith('#')) {
      e.preventDefault()
      const el = document.getElementById(href.slice(1))
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setMenuOpen(false)
  }

  return (
    <div className="landing" dir="rtl">
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <a href="/" className="landing-brand">
            <span className="landing-logo">
              <span className="material-symbols-outlined">storefront</span>
            </span>
            <span>M&amp;K Store</span>
          </a>

          <button
            type="button"
            className="landing-menu-toggle"
            aria-label="القائمة"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
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
              <div className="hero-content">
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
                  <span className="material-symbols-outlined">verified_user</span>
                  متجر، لوحة تحكم، وروابط بيع — كل شيء في مكان واحد
                </div>
              </div>

              <div className="hero-visual" aria-hidden="true">
                <div className="dash-mockup">
                  <div className="dash-mockup-side">
                    <span className="dm-brand"><span className="material-symbols-outlined">storefront</span></span>
                    {['space_dashboard', 'inventory_2', 'receipt_long', 'groups', 'query_stats', 'link', 'settings'].map((ic) => (
                      <span key={ic} className="dm-nav-item"><span className="material-symbols-outlined">{ic}</span></span>
                    ))}
                  </div>
                  <div className="dash-mockup-main">
                    <div className="dm-topbar"><span /><span className="dm-avatar" /></div>
                    <div className="dm-cards">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="dm-card">
                          <span className="dm-card-line" />
                          <span className="dm-card-bar" />
                        </div>
                      ))}
                    </div>
                    <div className="dm-chart">
                      {[...Array(12)].map((_, i) => (
                        <span key={i} className="dm-chart-bar" style={{ height: `${18 + ((i * 37) % 60)}%` }} />
                      ))}
                    </div>
                    <div className="dm-table">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="dm-row"><span /><span /><span /></div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="hero-preview-caption">واجهة لوحة التحكم — تمثيل مبسّط</p>
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
                <span className="material-symbols-outlined">{t.icon}</span>
                <span>{t.label}</span>
              </div>
            ))}
            <p className="trust-strip-tagline">كل ذلك في منصة واحدة</p>
          </div>
        </section>

        <section id="features" className="landing-section landing-section-soft">
          <div className="landing-container">
            <div className="section-head">
              <span className="section-eyebrow">المميزات</span>
              <h2>كل ما تحتاجه لإدارة متجرك</h2>
              <p className="section-subtitle">أدوات متكاملة صُممت لتنمي مبيعاتك وتوفر عليك الوقت والجهد.</p>
            </div>
            <div className="features-grid">
              {FEATURES.map((f) => (
                <div className="feature-card" key={f.title}>
                  <span className="feature-icon"><span className="material-symbols-outlined">{f.icon}</span></span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="landing-section">
          <div className="landing-container">
            <div className="section-head">
              <span className="section-eyebrow">كيف تعمل</span>
              <h2>ابدأ في أربع خطوات بسيطة</h2>
              <p className="section-subtitle">من التسجيل إلى أول عملية بيع — أسرع مما تتوقع.</p>
            </div>
            <div className="steps-grid">
              {STEPS.map((s) => (
                <div className="step-item" key={s.num}>
                  <span className="step-indicator">{s.num}</span>
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
              <div>
                <span className="section-eyebrow">لوحة تحكم احترافية</span>
                <h2>تحكّم كامل في متجرك من مكان واحد</h2>
                <p>
                  المبيعات، الطلبات، المخزون، العملاء، والتقارير — كلها في لوحة واحدة مصممة لتكون واضحة
                  وسريعة. لا صفحات مبعثرة، ولا أدوات معقدة.
                </p>
                <ul className="showcase-list">
                  <li><span className="material-symbols-outlined">check_circle</span>مؤشرات أداء حقيقية فور الطلب</li>
                  <li><span className="material-symbols-outlined">check_circle</span>تنبيهات مخزون تلقائية</li>
                  <li><span className="material-symbols-outlined">check_circle</span>تقارير ورسوم بيانية فورية</li>
                  <li><span className="material-symbols-outlined">check_circle</span>صلاحيات دقيقة لفريق العمل</li>
                </ul>
              </div>
              <div className="showcase-visual">
                <div className="stat-cards-grid">
                  {['المبيعات', 'الطلبات', 'المنتجات', 'العملاء'].map((label) => (
                    <div className="stat-card" key={label}>
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
            <div className="section-head">
              <span className="section-eyebrow">روابط البيع</span>
              <h2>خلّي كل عملية بيع قابلة للتتبع</h2>
              <p className="section-subtitle">
                أنشئ لكل بائع أو مسوّق رابطاً خاصاً به، واعرف من أين جاءت طلباتك ومن يحقق أفضل أداء — بدون
                أي حسابات يدوية.
              </p>
            </div>
            <div className="sales-steps-grid">
              {SALES_LINK_STEPS.map((s) => (
                <div className="sales-step-card" key={s.title}>
                  <span className="sales-step-icon"><span className="material-symbols-outlined">{s.icon}</span></span>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="sales-links-note">
              بائع واحد، عدة قنوات: أحمد / Facebook، أحمد / WhatsApp، أحمد / TikTok — كل رابط بأرقامه الخاصة.
            </p>
            <div className="sales-metrics">
              {[
                { label: 'الزيارات', value: '12,480', icon: 'visibility' },
                { label: 'الطلبات', value: '1,203', icon: 'receipt_long' },
                { label: 'المبيعات', value: '2,940,000', icon: 'payments', hint: 'ر.س' },
                { label: 'نسبة التحويل', value: '9.6%', icon: 'trending_up' },
              ].map((m) => (
                <div className="sales-metric" key={m.label}>
                  <span className="sales-metric-icon"><span className="material-symbols-outlined">{m.icon}</span></span>
                  <div className="sales-metric-text">
                    <span className="sales-metric-value">{m.value}{m.hint ? <small>{m.hint}</small> : null}</span>
                    <span className="sales-metric-label">{m.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="landing-section landing-section-soft">
          <div className="landing-container">
            <div className="section-head">
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
                    <div key={p.id} className={`pricing-card${isFeatured ? ' pricing-featured' : ''}`}>
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
                          <li key={fi}><span className="material-symbols-outlined">check</span>{f}</li>
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
            <div className="section-head">
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
                      <span className={`material-symbols-outlined faq-icon${open ? ' rotate' : ''}`}>expand_more</span>
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
              <span className="landing-logo"><span className="material-symbols-outlined">storefront</span></span>
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