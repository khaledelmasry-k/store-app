import { FunctionalComponent } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { useLocation } from 'wouter'
import { useAuth } from '../../shared/hooks/useAuth'
import { useSubscription } from '../../shared/hooks/useSubscription'
import { canUseFeature, getPlanLimit, isPlanLimitUnlimited } from '../../shared/services/subscription'
import { usersService } from '../../shared/services/users'
import './MerchantOnboardingTour.css'

const VERSION = 3
const RESUME_KEY = 'matjari:onboarding-tour-step'
const WELCOME_DISMISS_KEY = `matjari:merchant-welcome:hidden:v${VERSION}`
type Plan = ReturnType<typeof useSubscription>['plan']
type Step = { id: string; route: string; target: string; title: string; description: string; category: string; available?: (plan: Plan) => boolean }

const MAIN_STEPS: Step[] = [
  { id: 'merchant-status', route: '/dashboard', target: 'merchant-status', title: 'حالة المتجر والاشتراك', description: 'هنا تتابع حالة باقتك، الفترة التجريبية، حالة المتجر والإجراء المطلوب منك.', category: 'dashboard' },
  { id: 'trial-countdown', route: '/dashboard', target: 'trial-countdown', title: 'عداد التجربة', description: 'العداد يوضح الوقت المتبقي من تجربتك المجانية.', category: 'subscription' },
  { id: 'onboarding-checklist', route: '/dashboard', target: 'onboarding-checklist', title: 'خطوات تجهيز المتجر', description: 'دي خطوات تجهيز متجرك قبل النشر.', category: 'dashboard' },
  { id: 'kpi-revenue', route: '/dashboard', target: 'kpi-revenue', title: 'الإيرادات', description: 'تابع إيرادات متجرك خلال الفترة الحالية.', category: 'dashboard' },
  { id: 'kpi-orders', route: '/dashboard', target: 'kpi-orders', title: 'الطلبات', description: 'اعرف عدد الطلبات وحركة البيع بسرعة.', category: 'orders' },
  { id: 'kpi-profit', route: '/dashboard', target: 'kpi-profit', title: 'الربح', description: 'راجع الربح المحسوب من المبيعات وتكلفة المنتجات.', category: 'analytics' },
  { id: 'plan-usage', route: '/dashboard', target: 'plan-usage', title: 'استهلاك الخطة', description: 'هنا تتابع استهلاك حدود باقتك.', category: 'subscription' },
  { id: 'publish-store', route: '/dashboard', target: 'publish-store', title: 'نشر المتجر', description: 'عندما تكون جاهزًا انشر متجرك؛ لا يتم النشر تلقائيًا.', category: 'publishing' },
  { id: 'preview-store', route: '/dashboard', target: 'preview-store', title: 'معاينة المتجر', description: 'شاهد متجرك كما يراه العميل قبل النشر.', category: 'publishing' },
  { id: 'products', route: '/dashboard/products', target: 'products', title: 'المنتجات', description: 'أضف المنتجات والأسعار والمتغيرات والمخزون وتكلفة الإعلان.', category: 'products' },
  { id: 'marketing', route: '/dashboard/store-links', target: 'marketing', title: 'التسويق والمبيعات', description: 'أنشئ روابط بيع وعروضًا وكوبونات وصفحات هبوط متاحة لباقتك.', category: 'marketing', available: (plan) => !!plan && (getPlanLimit('salesLinks', plan) > 0 || isPlanLimitUnlimited('salesLinks', plan) || getPlanLimit('landingPages', plan) > 0 || canUseFeature('coupons', plan)) },
  { id: 'analytics', route: '/dashboard/analytics', target: 'analytics', title: 'التحليلات', description: 'تابع المبيعات والأرباح وتكلفة المنتجات والإعلانات.', category: 'analytics', available: (plan) => canUseFeature('analytics', plan) },
  { id: 'team', route: '/dashboard/team', target: 'team', title: 'الفريق', description: 'أضف أعضاء الفريق حسب صلاحيات وحدود باقتك.', category: 'settings', available: (plan) => !!plan && (getPlanLimit('staff', plan) > 1 || isPlanLimitUnlimited('staff', plan)) },
  { id: 'subscription', route: '/dashboard/subscription', target: 'subscription', title: 'الاشتراك والخطة', description: 'تابع الباقة والتجربة والاستهلاك والعروض وطلبات الدفع.', category: 'subscription' },
  { id: 'notifications', route: '/dashboard', target: 'notifications-bell', title: 'الإشعارات', description: 'من هنا هتوصلك تنبيهات الاشتراك والعروض والطلبات والتحديثات المهمة.', category: 'notifications' },
]

const MINI_TOURS: Record<string, Step[]> = {
  products: [{ id: 'products-workspace', route: '/dashboard/products', target: 'products-workspace', title: 'مساحة المنتجات', description: 'من هنا تدير المنتجات، التصنيفات، المتغيرات، التسعير بالكمية وتكلفة الإعلان.', category: 'products' }],
  themes: [{ id: 'themes-workspace', route: '/dashboard/themes', target: 'themes-workspace', title: 'مظهر المتجر', description: 'جرّب القوالب والمعاينة الحية، ثم احفظ التغيير عندما تكون راضيًا.', category: 'settings' }],
  analytics: [{ id: 'analytics-workspace', route: '/dashboard/analytics', target: 'analytics-workspace', title: 'تقارير متجرك', description: 'راجع الإيرادات والربح وتكلفة المنتج والإعلان من مكان واحد.', category: 'analytics' }],
  shipping: [{ id: 'shipping-workspace', route: '/dashboard/shipping', target: 'shipping-workspace', title: 'الشحن والتوصيل', description: 'فعّل شركة الشحن واضبط المناطق والأسعار قبل استقبال الطلبات.', category: 'settings' }],
}

const normalizedRoute = (value: string) => value.split('?')[0].replace(/\/+$/, '') || '/'
function waitForTarget(target: string, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const selector = `[data-tour="${target}"]`
    const find = () => { const el = document.querySelector(selector) as HTMLElement | null; if (!el) return null; const style = window.getComputedStyle(el); return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0 ? el : null }
    if (find()) { resolve(true); return }
    const observer = new MutationObserver(() => { if (!find()) return; observer.disconnect(); window.clearTimeout(timer); resolve(true) })
    const timer = window.setTimeout(() => { observer.disconnect(); resolve(false) }, timeoutMs)
    observer.observe(document.body, { childList: true, attributes: true, subtree: true })
  })
}
function waitForRoute(route: string, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => { const expected = normalizedRoute(route); const started = performance.now(); const check = () => { if (normalizedRoute(window.location.pathname) === expected) { resolve(true); return }; if (performance.now() - started >= timeoutMs) { resolve(false); return }; window.requestAnimationFrame(check) }; check() })
}

export const MerchantOnboardingTour: FunctionalComponent = () => {
  const { user } = useAuth(); const [location, navigate] = useLocation(); const storeId = user?.storeIds?.[0] || ''; const subscription = useSubscription(storeId)
  const [mode, setMode] = useState<'main' | keyof typeof MINI_TOURS>('main'); const [step, setStep] = useState(-1); const [saving, setSaving] = useState(false); const [transitioning, setTransitioning] = useState(false); const [ready, setReady] = useState(false); const [forceMain, setForceMain] = useState(false); const [welcomeChecked, setWelcomeChecked] = useState(false); const [welcomeVisible, setWelcomeVisible] = useState(false); const [hideWelcome, setHideWelcome] = useState(false); const [cardStyle, setCardStyle] = useState<Record<string, string>>({}); const activeTarget = useRef<HTMLElement | null>(null); const transitionLock = useRef(false)
  const eligible = user?.role === 'merchant' && user.onboardingTourCompleted !== true && user.onboardingTourSkipped !== true && (user.onboardingTourVersion || 0) < VERSION
  const mainEligible = eligible || forceMain
  const mainSteps = useMemo(() => MAIN_STEPS.filter((item) => !item.available || item.available(subscription.plan)), [subscription.plan])
  const steps = mode === 'main' ? mainSteps : MINI_TOURS[mode]
  const miniKey = `matjari:mini-tour:${mode}:v${VERSION}`

  useEffect(() => { if (!mainEligible || !storeId || subscription.loading || !subscription.plan || ready) return; const saved = sessionStorage.getItem(RESUME_KEY); const index = saved ? mainSteps.findIndex((item) => item.id === saved) : -1; setMode('main'); setStep(index >= 0 ? index : -1); setReady(true) }, [mainEligible, storeId, subscription.loading, subscription.plan, mainSteps, ready])
  useEffect(() => { if (!eligible || subscription.loading || welcomeChecked) return; setWelcomeVisible(localStorage.getItem(WELCOME_DISMISS_KEY) !== '1'); setWelcomeChecked(true) }, [eligible, subscription.loading, welcomeChecked])
  useEffect(() => { if (eligible || !ready || mode !== 'main') return; const key = normalizedRoute(location).replace('/dashboard/', '').replace('/dashboard', ''); const mini = MINI_TOURS[key as keyof typeof MINI_TOURS]; if (!mini || localStorage.getItem(`matjari:mini-tour:${key}:v${VERSION}`)) return; setMode(key as keyof typeof MINI_TOURS); setStep(0) }, [eligible, ready, mode, location])

  const persistMain = async (field: 'onboardingTourCompleted' | 'onboardingTourSkipped') => { if (!user || saving) return; setSaving(true); try { await usersService.update(user.uid, { [field]: true, onboardingTourVersion: VERSION }) } finally { setSaving(false) } }
  const close = async (field: 'onboardingTourCompleted' | 'onboardingTourSkipped') => { if (mode !== 'main') { localStorage.setItem(miniKey, '1'); activeTarget.current?.classList.remove('tour-target-active'); setMode('main'); setStep(-2); return }; if (!forceMain) await persistMain(field); setForceMain(false); activeTarget.current?.classList.remove('tour-target-active'); sessionStorage.removeItem(RESUME_KEY); setStep(-2) }
  const highlight = (target: string) => { activeTarget.current?.classList.remove('tour-target-active'); const el = document.querySelector(`[data-tour="${target}"]`) as HTMLElement | null; activeTarget.current = el; el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); el?.classList.add('tour-target-active') }
  useEffect(() => {
    if (step < 0 || !steps[step] || window.innerWidth <= 768) return
    const recalc = () => {
      const target = document.querySelector(`[data-tour="${steps[step].target}"]`) as HTMLElement | null
      if (!target) return
      const rect = target.getBoundingClientRect(); const width = Math.min(420, window.innerWidth - 32); const height = 190; const gap = 12
      const below = rect.bottom + gap + height <= window.innerHeight
      const top = below ? rect.bottom + gap : Math.max(12, rect.top - height - gap)
      const left = Math.max(16, Math.min(window.innerWidth - width - 16, rect.left + rect.width / 2 - width / 2))
      setCardStyle({ top: `${top}px`, left: `${left}px`, width: `${width}px`, transform: 'none' })
    }
    recalc(); window.addEventListener('resize', recalc); window.addEventListener('scroll', recalc, true)
    return () => { window.removeEventListener('resize', recalc); window.removeEventListener('scroll', recalc, true) }
  }, [step, steps])
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && step >= 0) void close('onboardingTourSkipped') }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [step])
  const showStep = async (requestedIndex: number): Promise<void> => {
    // Navigation plus lazy rendering can take a moment.  A ref blocks a second
    // click immediately (before state has had a chance to re-render), so one
    // press always owns one transition.
    if (transitionLock.current) return
    if (requestedIndex < 0) { setStep(-1); return }
    const currentStep = step
    const direction = requestedIndex < currentStep ? -1 : 1
    transitionLock.current = true; setTransitioning(true)
    try {
      let index = requestedIndex
      let currentRoute = normalizedRoute(window.location.pathname)
      while (index >= 0 && index < steps.length) {
        const next = steps[index]
        if (currentRoute !== normalizedRoute(next.route)) {
          navigate(next.route)
          if (!await waitForRoute(next.route)) { index += direction; continue }
          currentRoute = normalizedRoute(next.route)
        }
        if (window.innerWidth <= 768 && !document.querySelector('[aria-label="إغلاق القائمة"]')) (document.querySelector('[aria-label="فتح القائمة"]') as HTMLButtonElement | null)?.click()
        if (await waitForTarget(next.target)) {
          if (mode === 'main') sessionStorage.setItem(RESUME_KEY, next.id)
          setStep(index); highlight(next.target); return
        }
        index += direction
      }
      // If we walked off the end in the requested direction, complete or go to welcome
      if (direction === 1) await close('onboardingTourCompleted')
      else setStep(-1)
    } finally { transitionLock.current = false; setTransitioning(false) }
  }
  const dismissWelcome = () => { if (hideWelcome) localStorage.setItem(WELCOME_DISMISS_KEY, '1'); setWelcomeVisible(false) }
  const startFullGuide = () => { setWelcomeVisible(false); setForceMain(true); setMode('main'); setReady(true); void showStep(0) }
  useEffect(() => () => activeTarget.current?.classList.remove('tour-target-active'), [])
  if (user?.role !== 'merchant') return null
  if (!eligible && !forceMain) return null
  if (welcomeVisible) return <div className="merchant-tour-overlay merchant-welcome-overlay" role="dialog" aria-modal="true" aria-label="دليل بداية المتجر"><section className="merchant-start-guide"><div className="merchant-start-guide__eyebrow">دليل التاجر</div><h2>أهلاً بك — خلّي شغلك واضح من أول طلب</h2><p className="merchant-start-guide__intro">هذه الخلاصة تظهر عند الدخول لتعرف وظيفة كل جزء، وما هو جاهز الآن، وما يحتاج تجهيزًا منك قبل الاعتماد عليه.</p><div className="merchant-start-guide__grid"><article><b>١. المتجر والمنتجات</b><span>أضف المنتج والسعر والمخزون والصور، ثم عاين المتجر قبل نشره. النشر هو الذي يسمح للعميل بالشراء.</span></article><article><b>٢. الطلبات والدفع</b><span>كل طلب له كود تتبع. الدفع عند الاستلام جاهز، والتحويل البنكي يحتاج من العميل إثبات التحويل للمراجعة.</span></article><article><b>٣. الشحن</b><span>الشحن اليدوي يعمل فورًا. أي شركة API لا يظهر بجانبها «متصلة» تكون قيد التطوير ولا تنشئ شحنات تلقائيًا بعد.</span></article><article><b>٤. واتساب</b><span>كتابة رقم أو رسالة لا يرسل شيئًا. الإرسال يبدأ فقط بعد ربط Meta واختبار الاتصال واعتماد قوالب الرسائل.</span></article><article><b>٥. التسويق والنمو</b><span>الروابط والكوبونات والصفحات والتحليلات تظهر بحسب باقتك؛ ستجد سبب الإتاحة أو الترقية داخل كل شاشة.</span></article><article><b>٦. قبل النشر</b><span>راجع المنتجات، طرق الدفع، سعر الشحن، رابط المتجر وسياسة الاسترجاع؛ بعدها نفّذ طلب اختبار مثل العميل.</span></article></div><div className="merchant-start-guide__foot"><label><input type="checkbox" checked={hideWelcome} onChange={(event) => setHideWelcome((event.target as HTMLInputElement).checked)} /> لا تعرض هذا الدليل مرة أخرى على هذا الجهاز</label><div><button type="button" className="btn btn-ghost" onClick={dismissWelcome}>فهمت، أكمل للوحة</button><button type="button" className="btn btn-primary" onClick={startFullGuide}>ابدأ الجولة التفصيلية</button></div></div></section></div>
  if ((!mainEligible && mode === 'main') || !ready || (step < 0 && step !== -1) || !steps[step]) return null
  const current = steps[step]
  return <div className="merchant-tour-overlay" role="dialog" aria-modal="true" aria-label="الجولة التعريفية">{step === -1 ? <div className="merchant-tour-welcome"><h2>أهلاً بك في متجري</h2><p>هنعرّفك بسرعة على أهم أجزاء لوحة التحكم علشان تبدأ متجرك بسهولة.</p><div><button type="button" className="btn btn-primary" onClick={() => void showStep(0)} disabled={transitioning}>ابدأ الجولة</button><button type="button" className="btn btn-ghost" onClick={() => void close('onboardingTourSkipped')} disabled={saving || transitioning}>تخطي الآن</button></div></div> : <div className="merchant-tour-card" style={cardStyle}><span className="merchant-tour-progress">الخطوة {step + 1} من {steps.length}</span><h3>{current.title}</h3><p>{current.description}</p><div className="merchant-tour-actions"><button type="button" className="btn btn-ghost" disabled={transitioning} onClick={() => void showStep(step === 0 ? -1 : step - 1)}>السابق</button>{step < steps.length - 1 ? <button type="button" className="btn btn-primary" disabled={transitioning} onClick={() => void showStep(step + 1)}>{transitioning ? 'جارٍ الانتقال…' : 'التالي'}</button> : <button type="button" className="btn btn-primary" disabled={transitioning} onClick={() => void close('onboardingTourCompleted')}>إنهاء الجولة</button>}<button type="button" className="btn btn-ghost" disabled={transitioning} onClick={() => void close('onboardingTourSkipped')}>تخطي الجولة</button></div></div>}</div>
}
