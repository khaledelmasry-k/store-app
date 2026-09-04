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
import { getPublicPlatformConfigCallable, getPublicPromotionsCallable } from '../../shared/services/auth'
import heroCommerceVisual from '../../assets/brand/matjari-hero-commerce-v2.webp'
import dashboardShowcase from '../../assets/brand/matjari-dashboard-showcase-v1.png'
import './LandingPage.css'

const NAV_LINKS = [
  { href: '#features', label: 'المميزات' }, { href: '#solutions', label: 'الحلول' },
  { href: '#pricing', label: 'الأسعار' }, { href: '#how-it-works', label: 'كيف تعمل' },
  { href: '#faq', label: 'الأسئلة الشائعة' }, { href: '#contact', label: 'تواصل معنا' },
]
const FEATURES = [
  ['inventory_2', 'إدارة المنتجات', 'أنشئ منتجاتك ومتغيراتها وأسعارها من مساحة واحدة.'],
  ['receipt_long', 'الطلبات والعملاء', 'تابع الطلبات وبيانات العملاء في سير عمل واضح.'],
  ['inventory', 'المخزون والمتغيرات', 'اعرف ما يتوفر لديك وتلقَّ تنبيهات المخزون المهمة.'],
  ['local_offer', 'العروض والكوبونات', 'أطلق عروضك وكوبوناتك بمرونة تناسب متجرك.'],
  ['analytics', 'التحليلات والأرباح', 'افهم المبيعات والتكلفة والربح بقرارات مبنية على بياناتك.'],
  ['link', 'روابط البيع وصفحات الهبوط', 'شارك منتجاتك وتتبع مصادر البيع والحملات بسهولة.'],
] as const
const FAQS = [
  ['هل أحتاج إلى خبرة تقنية؟', 'لا. تبدأ بخطوات بسيطة، وتدير المنتجات والطلبات من لوحة واضحة دون إعدادات معقدة.'],
  ['هل يمكنني البدء مجاناً؟', 'نعم، توفر باقة Free أساسيات إدارة المتجر دون اشتراك شهري.'],
  ['هل أستطيع الترقية لاحقاً؟', 'نعم، يمكنك اختيار باقة أخرى عندما تنمو احتياجات متجرك.'],
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
  const [menuOpen, setMenuOpen] = useState(false); const [yearly, setYearly] = useState(false)
  const [enterpriseContact, setEnterpriseContact] = useState<{ number: string; enabled: boolean; message: string } | null>(null); const [promotions, setPromotions] = useState<any[]>([]); const theme = useTheme()
  useEffect(() => { setSeo({ title: 'Matjari | متجري', description: 'أنشئ متجرك وأدر تجارتك الإلكترونية من مكان واحد.', type: 'website' }); getPublicPromotionsCallable().then((r: any) => setPromotions(r.data?.promotions || [])).catch(() => setPromotions([])); let mounted = true; getPublicPlatformConfigCallable().then((res) => { const data = res.data as any; if (mounted) setEnterpriseContact({ number: String(data?.enterpriseWhatsAppNumber || ''), enabled: data?.enterpriseWhatsAppEnabled === true, message: String(data?.enterpriseWhatsAppMessage || 'مرحبًا، أرغب في الحصول على عرض سعر لحلول Enterprise / White Label من Matjari.') }) }).catch(() => { if (mounted) setEnterpriseContact(null) }); return () => { mounted = false } }, [])
  const plansRes = useCollection<SubscriptionPlan>('plans', {}); const plans = useMemo(() => CANONICAL_PLANS.map((canonical) => { const live = plansRes.data.find((plan) => plan.id === canonical.id || plan.name?.toLowerCase() === canonical.name.toLowerCase()); return live ? { ...canonical, ...live, id: canonical.id, sortOrder: canonical.sortOrder } : canonical }), [plansRes.data])
  const subscriptionPlans = plans.filter((plan) => plan.billingModel !== 'one_time' && plan.active !== false && plan.isPurchasable !== false && plan.archived !== true); const lifetimeOffer = plans.find((plan) => plan.billingModel === 'one_time' && plan.isLaunchOffer !== false && plan.active !== false && plan.isPurchasable !== false && plan.archived !== true && offerIsPubliclyAvailable(plan)); const publicPromotion = promotions.find((p) => p.placement === 'pricing' && p.planId && p.promotionalPrice != null)
  const goTo = (href: string) => (event: MouseEvent) => { if (href.startsWith('#')) { event.preventDefault(); document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }; setMenuOpen(false) }
  return <div className="landing" dir="rtl">
    <header className="landing-header"><div className="landing-container landing-header-inner"><a href="/" className="landing-brand" aria-label="Matjari"><BrandLogo className="landing-primary-logo" /></a><button type="button" className="landing-menu-toggle" aria-label="القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><Icon name={menuOpen ? 'close' : 'menu'} /></button><nav className={`landing-nav${menuOpen ? ' open' : ''}`} aria-label="التنقل الرئيسي">{NAV_LINKS.map((link) => <a key={link.label} href={link.href} className="landing-nav-link" onClick={goTo(link.href)}>{link.label}</a>)}<button type="button" className="landing-theme-toggle" aria-label="تبديل السمة" onClick={theme.toggle}><Icon name={theme.theme === 'dark' ? 'light_mode' : 'dark_mode'} /></button><Link href="/login" className="landing-nav-btn landing-nav-btn-ghost">تسجيل الدخول</Link><Link href="/register" className="landing-nav-btn landing-nav-btn-primary">ابدأ مجانًا</Link></nav></div></header>
    <main>
      <section className="landing-hero stitch-hero" aria-labelledby="landing-title"><div className="landing-container landing-hero-inner"><div className="landing-hero-copy"><span className="landing-eyebrow stitch-release-pill">منصة متكاملة لأصحاب التجارة الإلكترونية</span><h1 id="landing-title">كل ما تحتاجه لإدارة<br /><em>تجارتك الإلكترونية</em></h1><p>أنشئ متجرك، أدر منتجاتك وطلباتك ومبيعاتك، وتابع أرباحك من مكان واحد.</p><div className="landing-hero-actions"><Link href="/register"><Button icon="arrow_back">ابدأ مجانًا</Button></Link><a href="#features" onClick={goTo('#features')}>اكتشف المنصة <Icon name="arrow_downward" /></a></div></div><HeroCommerceVisual /></div></section>
      <section className="landing-stats" aria-label="حقائق عن متجري"><div className="landing-container landing-stats-grid">{[['5', 'باقات مرنة'], ['3 أيام', 'تجربة مجانية للباقات المدفوعة'], ['24/7', 'متجرك متاح لعملائك'], ['1', 'لوحة تحكم موحدة']].map(([value, label]) => <div className="landing-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></section>
      <section id="features" className="landing-section landing-features"><div className="landing-container"><div className="landing-section-heading"><span>المميزات</span><h2>كل ما تحتاجه لإدارة متجرك</h2><p>منصة متكاملة تجمع عمليات البيع والإدارة في مكان واحد.</p></div><div className="landing-feature-grid">{FEATURES.map(([icon, title, description]) => <article className="landing-feature-card stitch-capability-card" key={title}><span className="landing-feature-icon stitch-capability-icon"><Icon name={icon} /></span><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>
      <section id="how-it-works" className="landing-section landing-steps"><div className="landing-container"><div className="landing-section-heading"><span>كيف تعمل</span><h2>كيف تعمل متجري؟</h2><p>ثلاث خطوات بسيطة لبدء البيع.</p></div><div className="landing-steps-grid">{[['01', 'أنشئ متجرك', 'سجّل حسابك واختر الهوية المناسبة لمتجرك.'], ['02', 'أضف منتجاتك واضبط إعداداتك', 'أدخل منتجاتك وأسعارك ومخزونك في دقائق.'], ['03', 'انشر وابدأ استقبال الطلبات', 'انشر واجهتك وابدأ استقبال الطلبات من عملائك.']].map(([number, title, text]) => <article className="landing-step" key={number}><strong>{number}</strong><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
      <section id="solutions" className="landing-section landing-value"><div className="landing-container landing-value-grid"><div className="landing-value-copy"><span>حلول متجري</span><h2>كل تجارتك من مساحة تشغيل واحدة</h2><p>تابع المبيعات والطلبات والمخزون والأرباح وتكلفة الإعلان من مساحة تشغيل مصممة للتاجر.</p><ul><li><Icon name="check_circle" />بيانات واضحة لاتخاذ قرارات أسرع</li><li><Icon name="check_circle" />إدارة آمنة للمنتجات والطلبات</li><li><Icon name="check_circle" />تقارير ربحية داخلية للتاجر</li></ul><Link href="/register" className="landing-inline-cta">ابدأ الآن <Icon name="arrow_back" /></Link></div><DashboardShowcase /></div></section>
      <section id="pricing" className="landing-section landing-pricing"><div className="landing-container"><div className="landing-section-heading"><span>الأسعار</span><h2>اختر الباقة المناسبة لنموك</h2><p>ابدأ مجانًا، ثم طوّر أدواتك عندما يكبر متجرك.</p><div className="landing-billing-toggle" role="group" aria-label="دورة الفوترة"><button type="button" className={!yearly ? 'is-active' : ''} onClick={() => setYearly(false)}>شهري</button><button type="button" className={yearly ? 'is-active' : ''} onClick={() => setYearly(true)}>سنوي <small>وفر 20%</small></button></div></div>{publicPromotion && <div className="landing-promotion-banner"><div><strong>عرض خاص على {publicPromotion.planName || 'الباقة المختارة'}</strong><span>سعر ترويجي لفترة محدودة</span></div>{publicPromotion.endsAt && <CountdownTimer endsAt={publicPromotion.endsAt} label="ينتهي خلال" />}</div>}<div className="landing-pricing-grid stitch-pricing-grid">{subscriptionPlans.map((plan) => <div className="landing-plan-wrap stitch-plan-wrap" key={plan.id}><PricingCard plan={plan} yearly={yearly} featured={!!plan.isPopular} /><Link href={`/register?plan=${plan.id}`} className="landing-plan-link stitch-plan-link">اختر الخطة</Link></div>)}</div>{lifetimeOffer && <section className="landing-special-offer stitch-lifetime-offer"><div><span>عرض الاستخدام الدائم</span><h2>امتلك متجرك</h2><p>حق استخدام دائم لمتجر واحد داخل Matjari وفق المزايا والحدود المحددة.</p><Link href="/register?offer=lifetime" className="landing-special-cta stitch-offer-cta">اعرف المزيد</Link></div><PricingCard plan={lifetimeOffer} displayName="امتلك متجرك" /></section>}<section id="contact" className="landing-enterprise stitch-enterprise-offer"><div><span>حلول الأعمال</span><h2>Enterprise وWhite Label</h2><p>حلول مخصصة للفرق والمؤسسات مع هوية وتجربة تناسب احتياجك.</p></div>{enterpriseContact?.enabled && /^\d{8,15}$/.test(enterpriseContact.number) ? <a href={`https://wa.me/${enterpriseContact.number}?text=${encodeURIComponent(enterpriseContact.message)}`} target="_blank" rel="noopener noreferrer" className="landing-enterprise-cta">اطلب عرض سعر</a> : <button type="button" disabled className="landing-enterprise-cta">التواصل غير متاح حاليًا</button>}</section></div></section>
      <section id="faq" className="landing-section landing-faq"><div className="landing-container"><div className="landing-section-heading"><span>الأسئلة الشائعة</span><h2>إجابات واضحة قبل أن تبدأ</h2></div><div className="landing-faq-list rich-faq-list">{FAQS.map(([question, answer]) => <details key={question}><summary>{question}<Icon name="keyboard_arrow_down" /></summary><p>{answer}</p></details>)}</div></div></section>
      <section className="landing-final-cta stitch-final-cta"><div className="landing-container"><span>ابدأ اليوم</span><h2>جاهز تبدأ متجرك؟</h2><p>أنشئ متجرك خلال دقائق وابدأ إدارة تجارتك بثقة.</p><Link href="/register"><Button icon="rocket_launch">ابدأ الآن مجانًا</Button></Link></div></section>
    </main>
    <footer className="landing-footer stitch-footer-band"><div className="landing-container landing-footer-grid"><div className="landing-footer-brand"><BrandLogo className="landing-footer-logo" /><p>منصة متكاملة لإدارة تجارتك الإلكترونية.</p></div><div><h3>المنتج</h3><a href="#features" onClick={goTo('#features')}>المميزات</a><a href="#pricing" onClick={goTo('#pricing')}>الأسعار</a><a href="#how-it-works" onClick={goTo('#how-it-works')}>كيف تعمل</a></div><div><h3>الشركة</h3><a href="#contact" onClick={goTo('#contact')}>عن متجري</a><a href="#contact" onClick={goTo('#contact')}>تواصل معنا</a></div><div><h3>الدعم</h3><a href="#faq" onClick={goTo('#faq')}>الأسئلة الشائعة</a><a href="/login">مركز المساعدة</a></div><div><h3>قانوني</h3><a href="/terms">الشروط والأحكام</a><a href="/privacy">سياسة الخصوصية</a></div></div><div className="landing-container landing-footer-copy">© {new Date().getFullYear()} Matjari — متجري. جميع الحقوق محفوظة.</div></footer>
  </div>
}
export default LandingPage
