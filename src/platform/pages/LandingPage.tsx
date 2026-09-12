import { FunctionalComponent } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { BrandLogo } from '../../shared/components/brand/BrandLogo'
import { Button } from '../../shared/components/ui/Button'
import { Icon } from '../../shared/components/ui/Icon'
import { CountdownTimer } from '../../shared/components/subscription/CountdownTimer'
import { PricingCard } from '../../shared/components/subscription/PricingCard'
import { useCollection } from '../../shared/hooks/useCollection'
import { useTheme } from '../../shared/hooks/useTheme'
import { CANONICAL_PLANS } from '../../shared/plans/catalog'
import type { SubscriptionPlan } from '../../shared/types'
import { setSeo } from '../../shared/utils/seo'
import { getPublicPlatformConfigCallable, getPublicPromotionsCallable, getPublicShippingPartnersCallable } from '../../shared/services/auth'
import heroCommerceVisual from '../../assets/brand/matjari-hero-commerce-v2.webp'
import dashboardShowcase from '../../assets/brand/matjari-dashboard-showcase-v1.png'
import { OperatingJourney } from '../components/OperatingJourney'
import { resolveEnterpriseContact } from '../utils/enterpriseContact'
import './LandingPage.css'

const NAV_LINKS = [
  { href: '#features', label: 'المميزات' }, { href: '#solutions', label: 'الحلول' },
  { href: '#pricing', label: 'الأسعار' }, { href: '#how-it-works', label: 'كيف تعمل' },
  { href: '#faq', label: 'الأسئلة الشائعة' }, { href: '#contact', label: 'تواصل معنا' },
]
const FEATURES = [
  ['storefront', 'متجرك وكتالوجك', 'أنشئ واجهة متجرك ونظّم المنتجات والمتغيرات والمخزون من لوحة واحدة.'],
  ['receipt_long', 'الطلبات من البداية للنهاية', 'استقبل الطلب، راجع تفاصيله، وحدّث حالته في مسار تشغيل واضح.'],
  ['local_shipping', 'جاهزية الشحن', 'اضبط شركات وطرق الشحن، وراجع جاهزية Wasla دون إنشاء شحنة تلقائيًا.'],
  ['group', 'العملاء وCRM', 'احتفظ بتاريخ العميل وملاحظاته ومتابعاته داخل مساحة التاجر.'],
  ['link', 'روابط البيع وصفحات الهبوط', 'شارك عروضك بصفحات وروابط قابلة للتتبع من داخل Matjari.'],
  ['analytics', 'التقارير والربحية', 'اقرأ المبيعات والتكلفة والأرباح من بيانات التشغيل المسجلة لديك.'],
] as const

const FAQS = [
  ['هل أحتاج إلى خبرة تقنية؟', 'لا. تبدأ بخطوات بسيطة، وتدير المنتجات والطلبات من لوحة واضحة دون إعدادات معقدة.'],
  ['هل توجد باقة مجانية؟', 'لا. التسجيل الجديد متاح على Basic وStarter وGrowth وPro، وتبدأ كل باقة مدفوعة بتجربة مجانية لمدة 3 أيام.'],
  ['هل أستطيع الترقية لاحقاً؟', 'نعم. يمكنك اختيار الباقة المناسبة خلال فترة التجربة (3 أيام) أو بعد انتهائها من صفحة الاشتراك.'],
  ['هل بيانات التكلفة والربح عامة؟', 'لا. تبقى بيانات التكلفة والربح داخل لوحة التاجر ولا تظهر لعملائك.'],
]
function offerIsPubliclyAvailable(plan: SubscriptionPlan) { if (plan.isPubliclyAvailable === false) return false; const raw: any = plan.launchOfferEndsAt; if (!raw) return true; const ms = typeof raw.toDate === 'function' ? raw.toDate().getTime() : typeof raw.seconds === 'number' ? raw.seconds * 1000 : new Date(raw).getTime(); return !Number.isFinite(ms) || ms > Date.now() }
function DashboardShowcase() {
  return <figure className="landing-dashboard-showcase" aria-label="معاينة احترافية لمنظومة متجري"><img src={dashboardShowcase} alt="معاينة احترافية لإدارة المنتجات والطلبات والمخزون والتحليلات" loading="lazy" width="1536" height="1024" /></figure>
}
/* Legacy mockup retained for compatibility with older style tokens. */
function _DashboardMockup() {
  return <div className="landing-mockup" aria-label="معاينة لوحة تحكم متجري"><div className="landing-mockup-bar"><i /><i /><i /><span>لوحة تحكم متجري</span></div><div className="landing-mockup-body"><aside><b /><span /><span /><span /><span /><span /></aside><div className="landing-mockup-main"><div className="landing-mockup-heading"><span>نظرة عامة</span><small>هذا الشهر</small></div><div className="landing-mockup-stats"><div><small>المبيعات</small><strong>24,580 ج.م</strong><em>+18.4%</em></div><div><small>الطلبات</small><strong>248</strong><em>+12%</em></div><div><small>الأرباح</small><strong>8,420 ج.م</strong><em>+9.2%</em></div></div><div className="landing-mockup-chart"><div className="landing-chart-bars">{[35, 52, 44, 68, 58, 78, 64, 88, 72].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div><span>أداء المبيعات</span></div></div></div></div>
}
function HeroCommerceVisual() {
  return <figure className="landing-hero-visual" aria-label="منظومة متجري لإدارة البيع والمخزون والشحن والتحليلات">
    <span className="landing-hero-visual-orbit landing-hero-visual-orbit--one" aria-hidden="true" />
    <span className="landing-hero-visual-orbit landing-hero-visual-orbit--two" aria-hidden="true" />
    <img src={heroCommerceVisual} alt="متجر إلكتروني متكامل مع المنتجات والمخزون والشحن والدفع والتحليلات" width="1536" height="1024" fetchPriority="high" />
  </figure>
}
export const LandingPage: FunctionalComponent = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [enterpriseContact, setEnterpriseContact] = useState(() => resolveEnterpriseContact())
  const [promotions, setPromotions] = useState<any[]>([]); const [shippingPartners, setShippingPartners] = useState<any[]>([]); const theme = useTheme()
  useEffect(() => { setSeo({ title: 'Matjari | شغّل تجارتك من مكان واحد', description: 'منتج وبيع وطلب وعميل وشحن ومتابعة وربحية في دورة تشغيل واحدة.', type: 'website' }); getPublicPromotionsCallable().then((r: any) => setPromotions(r.data?.promotions || [])).catch(() => setPromotions([])) }, [])
  useEffect(() => {
    let mounted = true
    void getPublicPlatformConfigCallable()
      .then((result: any) => { if (mounted) setEnterpriseContact(resolveEnterpriseContact(result.data)) })
      .catch(() => { if (mounted) setEnterpriseContact(resolveEnterpriseContact()) })
    return () => { mounted = false }
  }, [])
  useEffect(() => { getPublicShippingPartnersCallable().then((result: any) => setShippingPartners(Array.isArray(result.data?.partners) ? result.data.partners : [])).catch(() => setShippingPartners([])) }, [])
  const plansRes = useCollection<SubscriptionPlan>('plans', {}); const plans = useMemo(() => CANONICAL_PLANS.map((canonical) => { const live = plansRes.data.find((plan) => plan.id === canonical.id || plan.name?.toLowerCase() === canonical.name.toLowerCase()); if (!live) return canonical; if (canonical.id !== 'plan-lifetime') return { ...live, ...canonical }; return { ...canonical, ...live, id: canonical.id, sortOrder: canonical.sortOrder } }), [plansRes.data])
  const subscriptionPlans = plans.filter((plan) => ['plan-basic', 'plan-starter', 'plan-growth', 'plan-pro'].includes(plan.id) && plan.billingModel !== 'one_time' && plan.active !== false && plan.isPurchasable !== false && plan.archived !== true); const lifetimeOffer = plans.find((plan) => plan.billingModel === 'one_time' && plan.isLaunchOffer !== false && plan.active !== false && plan.isPurchasable !== false && plan.archived !== true && offerIsPubliclyAvailable(plan)); const publicPromotion = promotions.find((p) => p.placement === 'pricing' && p.planId && p.promotionalPrice != null)
  const goTo = (href: string) => (event: MouseEvent) => { if (href.startsWith('#')) { event.preventDefault(); document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }; setMenuOpen(false) }
  return <div className="landing" dir="rtl">
    <header className="landing-header"><div className="landing-container landing-header-inner"><a href="/" className="landing-brand" aria-label="Matjari"><BrandLogo className="landing-primary-logo" /></a><button type="button" className="landing-menu-toggle" aria-label="القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><Icon name={menuOpen ? 'close' : 'menu'} /></button><nav className={`landing-nav${menuOpen ? ' open' : ''}`} aria-label="التنقل الرئيسي">{NAV_LINKS.map((link) => <a key={link.label} href={link.href} className="landing-nav-link" onClick={goTo(link.href)}>{link.label}</a>)}<button type="button" className="landing-theme-toggle" aria-label="تبديل السمة" onClick={theme.toggle}><Icon name={theme.theme === 'dark' ? 'light_mode' : 'dark_mode'} /></button><Link href="/login" className="landing-nav-btn landing-nav-btn-ghost">تسجيل الدخول</Link><Link href="/register" className="landing-nav-btn landing-nav-btn-primary">ابدأ تجربة 3 أيام مجانًا</Link></nav></div></header>
    <main>
      <section className="landing-hero stitch-hero" aria-labelledby="landing-title"><div className="landing-container landing-hero-inner"><div className="landing-hero-copy"><span className="landing-eyebrow stitch-release-pill">Commerce Operating System للتاجر العربي</span><h1 id="landing-title">شغّل تجارتك<br /><em>من مكان واحد</em></h1><p>منتج → بيع → طلب → عميل → شحن → متابعة → ربحية — دورة تشغيل واحدة بدل التنقل بين أدوات متفرقة.</p><div className="landing-hero-actions"><Link href="/register"><Button icon="arrow_back">ابدأ تجربة 3 أيام مجانًا</Button></Link><a href="#operating-flow" onClick={goTo('#operating-flow')}>شاهد دورة التشغيل <Icon name="arrow_downward" /></a></div></div><HeroCommerceVisual /></div></section>
      <section className="landing-stats" aria-label="حقائق عن متجري"><div className="landing-container landing-stats-grid">{[['3 أيام', 'تجربة لكل باقة جديدة'], ['4', 'باقات شهرية'], ['6', 'مراحل في دورة التشغيل'], ['1', 'لوحة تحكم موحدة']].map(([value, label]) => <div className="landing-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></section>
      <OperatingJourney />
      <section id="features" className="landing-section landing-features"><div className="landing-container"><div className="landing-section-heading"><span>المميزات</span><h2>كل ما تحتاجه لإدارة متجرك</h2><p>منصة متكاملة تجمع عمليات البيع والإدارة في مكان واحد.</p></div><div className="landing-feature-grid">{FEATURES.map(([icon, title, description]) => <article className="landing-feature-card stitch-capability-card" key={title}><span className="landing-feature-icon stitch-capability-icon"><Icon name={icon} /></span><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>
      <section id="how-it-works" className="landing-section landing-steps"><div className="landing-container"><div className="landing-section-heading"><span>كيف تعمل</span><h2>كيف تعمل متجري؟</h2><p>ثلاث خطوات بسيطة لبدء البيع.</p></div><div className="landing-steps-grid">{[['01', 'أنشئ متجرك', 'سجّل حسابك واختر الهوية المناسبة لمتجرك.'], ['02', 'أضف منتجاتك واضبط إعداداتك', 'أدخل منتجاتك وأسعارك ومخزونك في دقائق.'], ['03', 'انشر وابدأ استقبال الطلبات', 'انشر واجهتك وابدأ استقبال الطلبات من عملائك.']].map(([number, title, text]) => <article className="landing-step" key={number}><strong>{number}</strong><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
      <section id="solutions" className="landing-section landing-value"><div className="landing-container landing-value-grid"><div className="landing-value-copy"><span>مساحة التشغيل الحقيقية</span><h2>لوحتك تعكس ما يحدث في تجارتك</h2><p>تابع المنتجات والطلبات والعملاء والشحن والربحية من واجهات Matjari الفعلية، مع فصل بيانات التكلفة الداخلية عن تجربة العميل.</p><ul><li><Icon name="check_circle" />Storefront وCheckout وإدارة طلبات في نفس النظام</li><li><Icon name="check_circle" />CRM ومتابعات مرتبطة بسجل العميل</li><li><Icon name="check_circle" />روابط بيع وتقارير مبنية على بيانات التشغيل</li></ul><Link href="/register" className="landing-inline-cta">ابدأ تجربة 3 أيام مجانًا <Icon name="arrow_back" /></Link></div><DashboardShowcase /></div></section>
      <section id="shipping-partners" className="landing-section landing-shipping-partners"><div className="landing-container"><div className="landing-section-heading"><span>شركاء الشحن والتوصيل</span><h2>شركاؤك في توصيل الطلبات</h2><p>اربط متجرك بخدمات الشحن المتاحة على متجري وأدر دورة الطلب من مكان واحد.</p></div>{shippingPartners.length > 0 && <div className={`landing-partners-grid${shippingPartners.length >= 4 ? ' landing-partners-grid--moving' : ''}`} role="list"><div className="landing-partners-track">{shippingPartners.map((partner) => <a role="listitem" className="landing-partner-card" key={partner.id} href={partner.websiteUrl || '#'} target={partner.websiteUrl ? '_blank' : undefined} rel={partner.websiteUrl ? 'noopener noreferrer' : undefined}><img src={partner.logoUrl} alt={partner.name} /><span>{partner.name}</span></a>)}{shippingPartners.length >= 4 && shippingPartners.map((partner) => <a aria-hidden="true" tabIndex={-1} role="presentation" className="landing-partner-card landing-partner-card--duplicate" key={`duplicate-${partner.id}`} href="#"><img alt="" src={partner.logoUrl} /><span aria-hidden="true">{partner.name}</span></a>)}</div></div>}<div className="landing-partner-cta"><strong>هل تمثل شركة شحن؟</strong><Link href="/partners/shipping/apply">انضم كشريك شحن</Link></div></div></section>
      <section id="pricing" className="landing-section landing-pricing"><div className="landing-container"><div className="landing-section-heading"><span>أسعار الإطلاق</span><h2>أسعار الإطلاق — جرّب الباقة المناسبة لتشغيلك</h2><p>Basic 149 ج / شهر — Starter 249 ج / شهر — Growth 399 ج / شهر (الأكثر طلبًا) — Pro 649 ج / شهر. كل باقة مدفوعة جرّبها 3 أيام بمزاياها الكاملة. Lifetime 4,999 ج مرة واحدة بدون تجربة. Enterprise اطلب عرضًا مخصصًا بدون سعر ثابت.</p></div>{publicPromotion && <div className="landing-promotion-banner"><div><strong>عرض خاص على {publicPromotion.planName || 'الباقة المختارة'}</strong><span>سعر ترويجي لفترة محدودة</span></div>{publicPromotion.endsAt && <CountdownTimer endsAt={publicPromotion.endsAt} label="ينتهي خلال" />}</div>}<div className="landing-pricing-grid stitch-pricing-grid">{subscriptionPlans.map((plan) => {
        const cta = plan.id === 'plan-basic' ? 'جرّب Basic لمدة 3 أيام' : plan.id === 'plan-starter' ? 'جرّب Starter لمدة 3 أيام' : plan.id === 'plan-growth' ? 'جرّب Growth لمدة 3 أيام' : plan.id === 'plan-pro' ? 'جرّب Pro لمدة 3 أيام' : 'ابدأ تجربتك'
        return <div className="landing-plan-wrap stitch-plan-wrap" key={plan.id}><PricingCard plan={plan} featured={!!plan.isPopular} /><Link href={`/register?plan=${plan.id}`} className="landing-plan-link stitch-plan-link">{cta}</Link></div>
      })}</div>{lifetimeOffer && <section className="landing-special-offer stitch-lifetime-offer"><div><span>منتج منفصل عن الاشتراكات — بدون تجربة</span><h2>امتلك متجرك — Lifetime Access</h2><p>حق استخدام دائم لمتجر واحد وفق حدود العرض المحددة (1000 منتج، 1500 طلب/شهر، 3 أعضاء، 2GB، 20 رابط، 2 صفحة) — رسوم الخدمات الخارجية غير مشمولة.</p><Link href="/register?offer=lifetime" className="landing-special-cta stitch-offer-cta">اعرف التفاصيل</Link></div><PricingCard plan={lifetimeOffer} displayName="Lifetime Access" /></section>}
        <section className="landing-enterprise-offer" aria-labelledby="enterprise-title"><div><span>حلول مخصصة</span><h2 id="enterprise-title">محتاج متجر أو تشغيل بمواصفات خاصة؟</h2><p>لو حجم نشاطك أكبر من الباقات الحالية، أو تحتاج إعدادات أو تكاملات أو متطلبات خاصة، تواصل معنا لنجهز لك عرضًا يناسب طبيعة شغلك.</p><a href={enterpriseContact.href} className="landing-enterprise-cta" target={enterpriseContact.enabled ? '_blank' : undefined} rel={enterpriseContact.enabled ? 'noopener noreferrer' : undefined} onClick={enterpriseContact.enabled ? undefined : goTo('#contact')}><Icon name={enterpriseContact.enabled ? 'chat' : 'arrow_downward'} />{enterpriseContact.label}</a></div></section>
      </div></section>
      <section id="faq" className="landing-section landing-faq"><div className="landing-container"><div className="landing-section-heading"><span>الأسئلة الشائعة</span><h2>إجابات واضحة قبل أن تبدأ</h2></div><div className="landing-faq-list rich-faq-list">{FAQS.map(([question, answer]) => <details key={question}><summary>{question}<Icon name="keyboard_arrow_down" /></summary><p>{answer}</p></details>)}</div></div></section>
      <section className="landing-final-cta stitch-final-cta"><div className="landing-container"><span>ابدأ اليوم</span><h2>جاهز تجمع تجارتك في مكان واحد؟</h2><p>أنشئ متجرك وابدأ تجربة مجانية لمدة 3 أيام بمزايا باقتك الكاملة.</p><Link href="/register"><Button icon="rocket_launch">ابدأ تجربة 3 أيام مجانًا</Button></Link></div></section>
    </main>
    <footer id="contact" className="landing-footer stitch-footer-band"><div className="landing-container landing-footer-grid"><div className="landing-footer-brand"><BrandLogo className="landing-footer-logo" surface="dark" /><p>Commerce Operating System يجمع المتجر والطلبات والعملاء والشحن وCRM وروابط البيع والتقارير.</p></div><div><h3>المنتج</h3><a href="#features" onClick={goTo('#features')}>المميزات</a><a href="#pricing" onClick={goTo('#pricing')}>الأسعار</a><a href="#how-it-works" onClick={goTo('#how-it-works')}>كيف تعمل</a></div><div><h3>ابدأ</h3><a href="/register">ابدأ تجربة 3 أيام مجانًا</a><a href="/login">تسجيل الدخول</a></div><div className="landing-footer-contact"><h3>تواصل معنا</h3>{enterpriseContact.enabled ? <a className="landing-footer-whatsapp" href={enterpriseContact.href} target="_blank" rel="noopener noreferrer"><Icon name="chat" /><span>تحدث معنا على واتساب</span></a> : <p className="landing-footer-contact-note">تظهر قناة المبيعات هنا عند تفعيلها من إعدادات المنصة.</p>}<a href="#faq" onClick={goTo('#faq')}>الأسئلة الشائعة</a></div><div><h3>قانوني</h3><a href="/terms">الشروط والأحكام</a><a href="/privacy">سياسة الخصوصية</a></div></div><div className="landing-container landing-footer-copy">© {new Date().getFullYear()} Matjari — متجري. جميع الحقوق محفوظة.</div></footer>
  </div>
}
export default LandingPage
