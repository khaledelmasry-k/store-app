import { FunctionalComponent } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { BrandMark } from '../../shared/components/brand/BrandMark'
import { Button } from '../../shared/components/ui/Button'
import { Icon } from '../../shared/components/ui/Icon'
import { PricingCard } from '../../shared/components/subscription/PricingCard'
import { useCollection } from '../../shared/hooks/useCollection'
import { useTheme } from '../../shared/hooks/useTheme'
import { CANONICAL_PLANS } from '../../shared/plans/catalog'
import type { SubscriptionPlan } from '../../shared/types'
import './LandingPage.css'

const NAV_LINKS = [
  { href: '#features', label: 'المميزات' },
  { href: '#pricing', label: 'الأسعار' },
  { href: '#about', label: 'حلول الأعمال' },
  { href: '#about', label: 'عن المتجر' },
]

const CAPABILITIES = [
  { icon: 'receipt_long', title: 'إدارة منظمة للطلبات', description: 'واجهة مركزية لمعالجة الطلبات، تتبع الشحنات، وإدارة المرتجعات بكفاءة عالية.' },
  { icon: 'database', title: 'بيانات معزولة وآمنة', description: 'بنية سحابية تضمن خصوصية بيانات عملائك وأمان المعاملات المالية بأعلى معايير التشغـيل.' },
  { icon: 'trending_up', title: 'أرباح واضحة وتحليلات', description: 'تقارير تفصيلية لحظة بلحظة للمبيعات والأرباح وهوامش الربح لاتخاذ قرارات تسويقية مبنية على بيانات دقيقة.' },
  { icon: 'palette', title: 'واجهة متجر مخصصة', description: 'قدّم هوية متجرك باحترافية بشكل احترافي مع قوالب سريعة الاستجابة مصممة لتحقيق أفضل معدلات التحويل.' },
]

const FAQS = [
  ['هل أحتاج إلى خبرة تقنية؟', 'لا. تنظم M&K Store المنتجات والطلبات والعملاء في مساحة واضحة، مع إعداد متجر بسيط وخطوات نشر مباشرة.'],
  ['هل أستطيع إدارة المتجر والطلبات من مكان واحد؟', 'نعم. لوحة التاجر تجمع إدارة المنتجات والمخزون والطلبات والعملاء والتقارير في تجربة تشغيل واحدة.'],
  ['كيف أتابع الربح؟', 'يسجل التاجر سعر البيع وسعر التكلفة للمنتجات، ثم تعرض لوحة التاجر الربح والهامش عندما تتوفر بيانات التكلفة.'],
  ['هل يمكنني مشاركة روابط بيع؟', 'تدعم روابط البيع إنشاء رابط لكل مصدر أو حملة بحسب الصلاحيات المتاحة في خطتك، مع متابعة الأداء داخل لوحة التاجر.'],
]

function HeroProductVisual() {
  return (
    <div className="stitch-hero-visual" aria-hidden="true">
      <div className="stitch-dashboard-window">
        <div className="stitch-window-bar"><i /><i /><i /></div>
        <div className="stitch-dashboard-tabs">
          {['المبيعات', 'الطلبات', 'الربح', 'استخدام الخطة'].map((label) => <span key={label}><b />{label}</span>)}
        </div>
        <div className="stitch-chart-area">
          {[32, 52, 38, 68, 49, 76, 58].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
        </div>
        <div className="stitch-dashboard-foot"><span /><span /><span /></div>
      </div>
      <div className="stitch-order-float">
        <span className="stitch-float-badge">مكتمل</span>
        <strong>طلب جديد 1042#</strong>
        <b>العميل</b>
        <small>السعر: ٢٤٠ ج.م</small>
      </div>
      <div className="stitch-profit-float">
        <span>إجمالي الأرباح (اليوم)</span>
        <strong>493 ج.م</strong>
        <small>+12.5% منذ الأمس</small>
      </div>
    </div>
  )
}

function DashboardPreview({ kind }: { kind: 'products' | 'orders' | 'profit' | 'links' }) {
  if (kind === 'products') {
    return <div className="rich-preview rich-products-preview" aria-hidden="true">
      <div className="rich-preview-toolbar"><span>المنتجات</span><i>بحث عن منتج...</i><b>إضافة منتج</b></div>
      <div className="rich-product-rows">{['اسم المنتج', 'اسم المنتج', 'اسم المنتج'].map((name, i) => <div key={i} className="rich-product-row"><span className="rich-product-image" /><strong>{name}</strong><span>{i === 0 ? 'متوفر' : 'مخزون منخفض'}</span><b>{i === 0 ? '500 ج.م' : '320 ج.م'}</b></div>)}</div>
    </div>
  }
  if (kind === 'orders') {
    return <div className="rich-preview rich-orders-preview" aria-hidden="true">
      <div className="rich-preview-toolbar"><span>الطلبات</span><i>بحث برقم الطلب أو العميل...</i><b>كل الحالات</b></div>
      {['ORD-1024', 'ORD-1025', 'ORD-1026'].map((id, i) => <div className="rich-order-row" key={id}><strong dir="ltr">{id}</strong><span>العميل</span><span>{i === 0 ? 'جديد' : i === 1 ? 'قيد التجهيز' : 'تم التسليم'}</span><b>{i === 0 ? '240 ج.م' : '320 ج.م'}</b></div>)}
    </div>
  }
  if (kind === 'profit') {
    return <div className="rich-preview rich-profit-preview" aria-hidden="true">
      <div className="rich-metric-row"><span><small>سعر البيع</small><b>500 ج.م</b></span><span><small>سعر التكلفة</small><b>320 ج.م</b></span><span><small>الربح</small><b>180 ج.م</b></span><span><small>الهامش</small><b>36%</b></span></div>
      <div className="rich-profit-chart">{[32, 48, 40, 68, 55, 82, 64, 91].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div>
    </div>
  }
  return <div className="rich-preview rich-links-preview" aria-hidden="true">
    <div className="rich-preview-toolbar"><span>روابط البيع</span><i>المصدر</i><b>إنشاء رابط</b></div>
    {['Facebook', 'Instagram', 'TikTok', 'WhatsApp'].map((source, i) => <div className="rich-link-row" key={source}><strong>رابط البيع</strong><span>{source}</span><b>{i + 1} طلب</b><small>نسخ الرابط</small></div>)}
  </div>
}

function StorefrontPreview() {
  return <div className="rich-storefront-preview" aria-hidden="true">
    <div className="rich-storefront-nav"><strong>اسم المتجر</strong><span>الرئيسية</span><span>المنتجات</span><span>حسابي</span><i>السلة</i></div>
    <div className="rich-storefront-hero"><span>واجهة المتجر</span><strong>تجربة شراء واضحة</strong><small>صورة، عنوان، سعر، ومخزون في مكان واحد</small></div>
    <div className="rich-storefront-products">{[1, 2, 3].map((i) => <div key={i}><span /><strong>اسم المنتج</strong><small>500 ج.م</small></div>)}</div>
  </div>
}

export const LandingPage: FunctionalComponent = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [yearly, setYearly] = useState(false)
  const theme = useTheme()
  const plansRes = useCollection<SubscriptionPlan>('plans', {})
  const plans = useMemo(() => {
    // The canonical catalog defines the five public offers. Merge any live
    // platform overrides without allowing a partial collection to remove a
    // plan from the public pricing presentation.
    return CANONICAL_PLANS.map((canonical) => {
      const live = plansRes.data.find((plan) => plan.id === canonical.id || plan.name?.toLowerCase() === canonical.name.toLowerCase())
      return live ? { ...canonical, ...live, id: canonical.id, sortOrder: canonical.sortOrder } : canonical
    })
  }, [plansRes.data])

  const goTo = (href: string) => (event: MouseEvent) => {
    if (href.startsWith('#')) {
      event.preventDefault()
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setMenuOpen(false)
  }

  return (
    <div className="landing landing-stitch-exact" dir="rtl">
      <header className="landing-header stitch-header">
        <div className="landing-container stitch-header-inner">
          <a href="/" className="landing-brand"><BrandMark small /><span>M&amp;K Store</span></a>
          <button type="button" className="landing-menu-toggle" aria-label="القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <nav className={`landing-nav${menuOpen ? ' open' : ''}`} aria-label="التنقل الرئيسي">
            {NAV_LINKS.map((link) => <a key={link.label} href={link.href} className="landing-nav-link" onClick={goTo(link.href)}>{link.label}</a>)}
            <button type="button" className="landing-nav-btn landing-theme-toggle" aria-label="تبديل السمة" onClick={theme.toggle}>
              <Icon name={theme.theme === 'dark' ? 'light_mode' : 'dark_mode'} />
            </button>
            <Link href="/login" className="landing-nav-btn landing-nav-btn-ghost">تسجيل الدخول</Link>
            <Link href="/register" className="landing-nav-btn landing-nav-btn-primary">ابدأ الآن مجاناً</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="stitch-hero" aria-labelledby="landing-title">
          <div className="landing-container stitch-hero-grid">
            <div className="stitch-hero-copy">
              <span className="stitch-release-pill">الإصدار 3.0 متاح الآن <Icon name="bolt" /></span>
              <h1 id="landing-title">ابنِ متجرك.<br /><em>أدر مبيعاتك.</em><br />كبّر تجارتك.</h1>
              <p>منصة إلكترونية سحابية متكاملة مصممة للشركات لتقديم تجربة تسوق وإدارة عمليات البيع بكفاءة وأمان، مع لوحة تحكم متطورة للمخزون والأرباح.</p>
              <div className="stitch-hero-actions">
                <Link href="/register"><Button icon="arrow_back">ابدأ رحلتك التجريبية</Button></Link>
                <a href="#features" onClick={goTo('#features')}>استكشف المنصة</a>
              </div>
            </div>
            <HeroProductVisual />
          </div>
        </section>

        <section id="features" className="stitch-capabilities">
          <div className="landing-container">
            <div className="stitch-section-heading">
              <span>قدرات المنصة</span>
              <h2>مصممة للنمو والتحكم المطلق</h2>
              <p>أدوات احترافية مبنية على بنية تقنية صلبة لتوفير رؤية شاملة لأعمالك وإدارة المخزون بدقة.</p>
            </div>
            <div className="stitch-capability-grid">
              {CAPABILITIES.map((item) => (
                <article className="stitch-capability-card" key={item.title}>
                  <span className="stitch-capability-icon"><Icon name={item.icon} /></span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="stitch-rich-overview" id="about">
          <div className="landing-container rich-section-grid">
            <div className="rich-copy"><span>منصة واحدة مترابطة</span><h2>كل ما تحتاجه لتشغيل تجارتك في مكان واحد</h2><p>من إضافة المنتج إلى استقبال الطلب ومتابعة الربح، تعمل مكونات M&amp;K Store من نفس البيانات وبصلاحيات واضحة.</p><ul><li><Icon name="check_circle" />منتجات ومخزون ومتغيرات</li><li><Icon name="check_circle" />طلبات وعملاء ومصادر بيع</li><li><Icon name="check_circle" />اشتراك وحدود استخدام واضحة</li></ul></div>
            <DashboardPreview kind="products" />
          </div>
        </section>

        <section className="stitch-rich-feature rich-feature-alt">
          <div className="landing-container rich-section-grid">
            <DashboardPreview kind="orders" />
            <div className="rich-copy"><span>المنتجات والمخزون</span><h2>اعرف ما لديك وما يحتاج إلى إجراء</h2><p>أنشئ المنتجات بالصور والأسعار والمتغيرات، وتابع حالة كل منتج ومخزون كل تركيبة من الألوان والمقاسات.</p><div className="rich-tags"><b>صور المنتج</b><b>السعر والتكلفة</b><b>الألوان والمقاسات</b><b>تنبيهات المخزون</b></div></div>
          </div>
        </section>

        <section className="stitch-rich-feature">
          <div className="landing-container rich-section-grid">
            <div className="rich-copy"><span>الطلبات والعملاء</span><h2>من أول طلب حتى آخر متابعة</h2><p>شاهد رقم الطلب والعميل والمنتجات والحالة في مساحة عملية تساعدك على إنجاز الطلبات دون تبديل الأدوات.</p><div className="rich-status-list"><span>طلب جديد</span><span>قيد التجهيز</span><span>تم الشحن</span><span>تم التسليم</span></div></div>
            <DashboardPreview kind="orders" />
          </div>
        </section>

        <section className="stitch-rich-feature rich-profit-band">
          <div className="landing-container rich-section-grid">
            <DashboardPreview kind="profit" />
            <div className="rich-copy"><span>الربح الحقيقي</span><h2>لا تخلط بين المبيعات والربح</h2><p>تظهر للمُتاجر صورة أوضح للنتيجة: سعر البيع، سعر التكلفة، الربح لكل وحدة، وهامش الربح عند اكتمال بيانات التكلفة.</p><div className="rich-profit-note"><Icon name="lock" /><span>بيانات التكلفة والربح خاصة بالتاجر ولا تظهر للعملاء.</span></div></div>
          </div>
        </section>

        <section className="stitch-rich-feature">
          <div className="landing-container rich-section-grid">
            <div className="rich-copy"><span>روابط البيع</span><h2>اجعل كل عملية بيع قابلة للتتبع</h2><p>أنشئ روابط لمصادر البيع المدعومة، شاركها مع فريقك أو حملاتك، وتابع الطلبات والمبيعات المرتبطة بها داخل لوحة التاجر.</p><div className="rich-tags"><b>رابط البيع</b><b>مصدر الحملة</b><b>نسخ وفتح الرابط</b><b>أداء الرابط</b></div></div>
            <DashboardPreview kind="links" />
          </div>
        </section>

        <section className="stitch-rich-feature rich-feature-alt">
          <div className="landing-container rich-section-grid">
            <DashboardPreview kind="profit" />
            <div className="rich-copy"><span>تحليلات واضحة</span><h2>اتخذ قراراتك من أرقام متجرك</h2><p>راجع اتجاه المبيعات والطلبات والربح والمخزون في لوحات تساعدك على فهم الأداء دون ادعاءات أو أرقام مجهولة المصدر.</p></div>
          </div>
        </section>

        <section className="stitch-rich-store">
          <div className="landing-container rich-store-heading"><span>متجرك كما يراه العميل</span><h2>خصص واجهة البيع وانشرها بثقة</h2><p>هوية المتجر، الشعار، الألوان، القالب، والواجهة الرئيسية في تجربة تخصيص واحدة مع معاينة حية.</p></div>
          <div className="landing-container rich-store-grid"><StorefrontPreview /><div className="rich-copy"><h3>من لوحة التصميم إلى واجهة شراء حقيقية</h3><ul><li><Icon name="check_circle" />شعار واسم وهوية المتجر</li><li><Icon name="check_circle" />ألوان وقالب وواجهة رئيسية</li><li><Icon name="check_circle" />معاينة قبل النشر وفتح رابط المتجر</li></ul><Link href="/register"><Button icon="palette">ابدأ بناء متجرك</Button></Link></div></div>
        </section>

        <section className="stitch-workflow">
          <div className="landing-container"><div className="stitch-section-heading"><span>كيف تعمل المنصة</span><h2>من الحساب إلى أول عملية بيع</h2><p>رحلة واضحة تساعدك على إطلاق متجرك ثم إدارة البيع يومياً.</p></div><div className="rich-workflow-grid">{['إنشاء الحساب', 'اختيار الخطة', 'إنشاء المتجر', 'إضافة المنتجات', 'نشر المتجر', 'مشاركة الرابط', 'استقبال الطلبات', 'متابعة الأرباح'].map((step, i) => <div key={step}><b>{String(i + 1).padStart(2, '0')}</b><span>{step}</span></div>)}</div></div>
        </section>

        <section id="pricing" className="stitch-pricing">
          <div className="landing-container">
            <div className="stitch-section-heading">
              <span>باقات الاشتراك</span>
              <h2>أسعار شفافة تناسب حجم عملك</h2>
              <p>اختر الخطة التي تلبي احتياجات مبيعاتك الحالية، مع إمكانية الترقية مع نمو متجرك. لا توجد رسوم خفية.</p>
              <div className="stitch-billing-toggle" role="group" aria-label="دورة الفوترة">
                <button type="button" className={!yearly ? 'is-active' : ''} onClick={() => setYearly(false)}>شهري</button>
                <button type="button" className={yearly ? 'is-active' : ''} onClick={() => setYearly(true)}>سنوي <small>وفر 20%</small></button>
              </div>
            </div>
            <div className="stitch-pricing-grid">
              {plans.map((plan) => <div className="stitch-plan-wrap" key={plan.id}>
                <PricingCard plan={plan} yearly={yearly} featured={!!plan.isPopular} />
                <Link href={`/register?plan=${plan.id}`} className="stitch-plan-link">اختر الخطة</Link>
              </div>)}
            </div>
          </div>
        </section>

        <section className="stitch-faq-section"><div className="landing-container"><div className="stitch-section-heading"><span>الأسئلة الشائعة</span><h2>كل ما تحتاج معرفته قبل البدء</h2></div><div className="rich-faq-list">{FAQS.map(([question, answer]) => <details key={question}><summary>{question}<Icon name="keyboard_arrow_down" /></summary><p>{answer}</p></details>)}</div></div></section>

        <section className="stitch-final-cta"><div className="landing-container"><span>ابدأ من مكان واحد</span><h2>ابنِ متجرك وأدر تجارتك بثقة</h2><p>أنشئ حسابك، اختر خطتك، وأطلق واجهة البيع التي تناسب عملك.</p><Link href="/register"><Button icon="rocket_launch">ابدأ متجرك الآن</Button></Link></div></section>

        <section className="stitch-footer-band">
          <div className="landing-container stitch-footer-grid">
            <div><BrandMark small /><strong>M&amp;K Store</strong><p>منصة التجارة الإلكترونية المتكاملة.</p></div>
            <div><h3>المنصة</h3><a href="#features" onClick={goTo('#features')}>المنتجات</a><a href="#features" onClick={goTo('#features')}>إدارة المخزون</a><a href="#features" onClick={goTo('#features')}>تحليلات الأرباح</a></div>
            <div><h3>الخدمات</h3><a href="/register">ابدأ الآن</a><a href="/login">مركز المساعدة</a><a href="/login">تواصل معنا</a></div>
            <div><h3>قانونية</h3><a href="/terms">الشروط والأحكام</a><a href="/privacy">سياسة الخصوصية</a></div>
          </div>
          <div className="landing-container stitch-footer-copy">© {new Date().getFullYear()} M&amp;K Store. جميع الحقوق محفوظة لشركة حلول التجارة الذكية.</div>
        </section>
      </main>
    </div>
  )
}

export default LandingPage
