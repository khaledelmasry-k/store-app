import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link, useLocation } from 'wouter'
import { Button } from '../ui/Button'
import { AuthShell } from './AuthShell'
import { registerMerchant } from '../../services/auth'
import { useToast } from '../../hooks/useToast'
import { useCollection } from '../../hooks/useCollection'
import { formatCurrency } from '../../utils/format'
import { isEmailValid } from '../../utils/validators'
import type { SubscriptionPlan } from '../../types'
import { Icon } from '../ui/Icon'
import { PricingCard } from '../subscription/PricingCard'
import { CANONICAL_PLANS } from '../../plans/catalog'

const STEPS = [
  { key: 'account', label: 'إنشاء الحساب' },
  { key: 'plan', label: 'اختيار الباقة' },
  { key: 'store', label: 'إعداد المتجر' },
  { key: 'done', label: 'تم' },
]

const PASSWORD_RULES = [
  { label: '6 أحرف على الأقل', test: (p: string) => p.length >= 6 },
  { label: 'حرف كبير', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'رقم واحد', test: (p: string) => /\d/.test(p) },
]

const STRENGTH_SEGMENTS = [0, 1, 2, 3, 4]

export const Register:FunctionalComponent = () => {
  const [loc] = useLocation()
  const params = new URLSearchParams(loc.split('?')[1] || window.location.search)
  const plansRes = useCollection<SubscriptionPlan>('plans', {})
  const plans = [...(plansRes.data.length ? plansRes.data : CANONICAL_PLANS)]
    .filter((p) => p.active !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const [planId, setPlanId] = useState(params.get('plan') || undefined)
  const selectedPlan = planId ? plans.find((p) => p.id === planId) : undefined

  const toast = useToast()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', storeName: '', storeRef: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const canProceed = () => {
    if (step === 0) return isEmailValid(form.email) && form.password.length >= 6 && form.name.trim() && form.phone.trim().length >= 8
    if (step === 2) return form.storeName.trim()
    return true
  }

  const next = () => {
    if (!canProceed()) {
      toast.push('أكمل البيانات المطلوبة', undefined, 'error')
      return
    }
    if (step < STEPS.length - 1) setStep(step + 1)
  }

  const prev = () => {
    if (step > 0) setStep(step - 1)
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    setError('')
    if (!isEmailValid(form.email)) return setError('بريد إلكتروني غير صالح')
    if (form.password.length < 6) return setError('كلمة المرور 6 أحرف على الأقل')
    if (!form.name.trim() || !form.phone.trim() || !form.storeName.trim()) return setError('أدخل الاسم ورقم الهاتف واسم المتجر')
    setLoading(true)
    try {
      await registerMerchant({
        email: form.email,
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim(),
        storeName: form.storeName.trim(),
        storeRef: form.storeRef.trim() || form.storeName.trim(),
        planId,
      })
      setDone(true)
    } catch (err: any) {
      setError(err?.message || 'فشل التسجيل')
      toast.push('فشل التسجيل', undefined, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthShell variant="brand">
        <div className="auth-card">
          <div className="auth-status-card">
            <div className="auth-status-icon">
              <Icon name="check_circle" />
            </div>
            <h1 className="auth-title">تم إنشاء حسابك بنجاح</h1>
            <p className="auth-subtitle">يمكنك الآن الدخول مباشرة وتجربة {selectedPlan?.name || 'باقتك'} مجاناً، والبدء في إعداد متجرك فوراً.</p>
            <Link href="/login?role=merchant">
              <Button variant="outline" block>تسجيل الدخول</Button>
            </Link>
          </div>
        </div>
      </AuthShell>
    )
  }

  const strength = PASSWORD_RULES.reduce((n, r) => n + (r.test(form.password) ? 1 : 0), 0)

  return (
    <AuthShell variant="brand">
      <div className="auth-card auth-card--wizard">
        <ol className="auth-stepper" aria-label="خطوات إنشاء الحساب">
          {STEPS.map((s, i) => (
            <li key={s.key} className={`auth-step${i < step ? ' auth-step--done' : ''}`}>
              <div className={`auth-step-dot${i < step ? ' auth-step-dot--done' : i === step ? ' auth-step-dot--active' : ''}`}>
                {i < step ? <Icon name="check" /> : i + 1}
              </div>
              <span className={`auth-step-label${i <= step ? ' auth-step-label--active' : ''}`}>{s.label}</span>
            </li>
          ))}
        </ol>

        {plans.length > 0 && (
          <div className="register-plan-strip" aria-label="اختيار الباقة">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`register-plan-pill${p.id === selectedPlan?.id ? ' is-selected' : ''}${p.isPopular ? ' is-popular' : ''}`}
                onClick={() => {
                  setPlanId(p.id)
                  setStep(1)
                }}
              >
                <span>{p.name}</span>
                <strong>{formatCurrency(p.priceMonthly)}</strong>
                {p.isPopular && <em>الأكثر شعبية</em>}
              </button>
            ))}
          </div>
        )}

        {step === 0 && (
          <>
            <h1 className="auth-title">إنشاء حساب جديد</h1>
            <p className="auth-subtitle">أدخل تفاصيلك للبدء في استخدام المنصة</p>
            <form onSubmit={submit} className="auth-form">
              <div className="auth-form-field">
                <label htmlFor="reg-name">الاسم الكامل</label>
                <div className="auth-input-wrap">
                  <Icon name="person" className="auth-input-icon" ariaHidden />
                  <input
                    id="reg-name"
                    value={form.name}
                    onInput={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })}
                    required
                    placeholder="محمد أحمد"
                    autoComplete="name"
                  />
                </div>
              </div>
              <div className="auth-form-field">
                <label htmlFor="reg-phone">رقم الهاتف</label>
                <div className="auth-input-wrap">
                  <Icon name="smartphone" className="auth-input-icon" ariaHidden />
                  <input
                    id="reg-phone"
                    type="tel"
                    value={form.phone}
                    onInput={(e) => setForm({ ...form, phone: (e.target as HTMLInputElement).value })}
                    required
                    placeholder="01xxxxxxxxx"
                    autoComplete="tel"
                  />
                </div>
              </div>
              <div className="auth-form-field">
                <label htmlFor="reg-email">البريد الإلكتروني</label>
                <div className="auth-input-wrap">
                  <Icon name="mark_email_unread" className="auth-input-icon" ariaHidden />
                  <input
                    id="reg-email"
                    type="email"
                    value={form.email}
                    onInput={(e) => setForm({ ...form, email: (e.target as HTMLInputElement).value })}
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="auth-form-field">
                <label htmlFor="reg-password">كلمة المرور</label>
                <div className="auth-input-wrap">
                  <Icon name="lock" className="auth-input-icon" ariaHidden />
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onInput={(e) => setForm({ ...form, password: (e.target as HTMLInputElement).value })}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="auth-vis-toggle"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <Icon name={showPassword ? 'visibility_off' : 'visibility'} ariaHidden />
                  </button>
                </div>
                <div className={`auth-strength auth-strength--${strength}`} aria-hidden="true">
                  {STRENGTH_SEGMENTS.map((i) => (
                    <i key={i} />
                  ))}
                </div>
                <ul className="auth-criteria">
                  {PASSWORD_RULES.map((r) => {
                    const ok = r.test(form.password)
                    return (
                      <li key={r.label} className={ok ? 'is-ok' : ''}>
                        <Icon name={ok ? 'check' : 'check_circle'} ariaHidden />
                        <span>{r.label}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
              {error && <p className="field-error">{error}</p>}
              <label className="auth-terms">
                <input type="checkbox" />
                <span>
                  أوافق على <a href="/terms">شروط الاستخدام</a> و<a href="/privacy">سياسة الخصوصية</a>
                </span>
              </label>
              <Button type="button" block onClick={next} icon="arrow_forward">التالي</Button>
              <p className="auth-security-note">
                <Icon name="shield" ariaHidden />
                بياناتك محمية ومشفرة بأعلى معايير الأمان
              </p>
            </form>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="auth-title">اختيار الباقة</h1>
            <p className="auth-subtitle">اختر باقتك — جربها مجاناً لـ {Number(selectedPlan?.trialDays || 3)} أيام</p>
            {selectedPlan && (
              <div className="plan-selected">
                <Icon name="workspace_premium" />
                <div>
                  <strong>{selectedPlan.name}</strong>
                  <span className="muted small">
                    {selectedPlan.launchEnabled && Number(selectedPlan.launchPrice) > 0
                      ? `أول شهر ${formatCurrency(selectedPlan.launchPrice)} ثم ${formatCurrency(selectedPlan.priceMonthly)} شهرياً`
                      : `${formatCurrency(selectedPlan.priceMonthly)} / شهرياً`}
                  </span>
                </div>
              </div>
            )}
            <div className="plan-cards plan-cards--pricing">
              {plans.map((p) => (
                <PricingCard
                  key={p.id}
                  plan={p}
                  featured={!!p.isPopular}
                  selected={p.id === selectedPlan?.id}
                  onSelect={() => setPlanId(p.id)}
                  ctaLabel={p.id === selectedPlan?.id ? 'تم الاختيار' : 'اختيار الخطة'}
                />
              ))}
            </div>
            <div className="auth-step-actions">
              <Button variant="outline" onClick={prev}>السابق</Button>
              <Button onClick={next} icon="arrow_forward">التالي</Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="auth-title">إعداد المتجر</h1>
            <p className="auth-subtitle">أدخل بيانات متجرك</p>
            <form onSubmit={submit} className="auth-form">
              <div className="auth-form-field">
                <label htmlFor="store-name">اسم المتجر</label>
                <div className="auth-input-wrap">
                  <Icon name="storefront" className="auth-input-icon" ariaHidden />
                  <input
                    id="store-name"
                    value={form.storeName}
                    onInput={(e) => setForm({ ...form, storeName: (e.target as HTMLInputElement).value })}
                    required
                  />
                </div>
              </div>
              <div className="auth-form-field">
                <label htmlFor="store-ref">الرابط المختصر</label>
                <div className="auth-input-wrap">
                  <Icon name="link" className="auth-input-icon" ariaHidden />
                  <input
                    id="store-ref"
                    value={form.storeRef}
                    onInput={(e) => setForm({ ...form, storeRef: (e.target as HTMLInputElement).value })}
                  />
                </div>
                <span className="auth-hint">اتركه فارغاً لاستخدام اسم المتجر</span>
              </div>
              {error && <p className="field-error">{error}</p>}
              <div className="auth-step-actions">
                <Button variant="outline" type="button" onClick={prev}>السابق</Button>
                <Button type="submit" loading={loading} icon="check">إنشاء الحساب</Button>
              </div>
            </form>
          </>
        )}

        <p className="auth-switch">لديك حساب بالفعل؟ <Link href="/login?role=merchant">سجّل الدخول</Link></p>
      </div>
    </AuthShell>
  )
}