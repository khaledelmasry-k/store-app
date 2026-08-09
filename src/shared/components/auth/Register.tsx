import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { Link, useLocation } from 'wouter'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { BrandMark } from '../brand/BrandMark'
import { AuthShell } from './AuthShell'
import { registerMerchant } from '../../services/auth'
import { useToast } from '../../hooks/useToast'
import { useCollection } from '../../hooks/useCollection'
import { formatCurrency } from '../../utils/format'
import { isEmailValid } from '../../utils/validators'
import type { SubscriptionPlan } from '../../types'
import { Icon } from '../ui/Icon'

const STEPS = [
  { key: 'account', label: 'إنشاء الحساب', icon: 'person' },
  { key: 'plan', label: 'اختيار الباقة', icon: 'workspace_premium' },
  { key: 'store', label: 'إعداد المتجر', icon: 'store' },
  { key: 'done', label: 'تم', icon: 'check_circle' },
]

export const Register:FunctionalComponent = () => {
  const [loc] = useLocation()
  const params = new URLSearchParams(loc.split('?')[1] || window.location.search)
  const plansRes = useCollection<SubscriptionPlan>('plans', {})
  const plans = plansRes.data
  const [planId, setPlanId] = useState(params.get('plan') || undefined)
  const selectedPlan = planId ? plans.find((p) => p.id === planId) : undefined

  const toast = useToast()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', storeName: '', storeRef: '' })
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
      <AuthShell>
        <div className="auth-card">
          <div className="order-confirmed">
            <div className="big-check"><Icon name="check" /></div>
            <h1 className="auth-title">تم إنشاء حسابك بنجاح</h1>
            <p className="auth-subtitle">يمكنك الآن الدخول مباشرة وتجربة {selectedPlan?.name || 'باقتك'} مجاناً، والبدء في إعداد متجرك فوراً.</p>
            <Link href="/login?role=merchant"><Button variant="outline">تسجيل الدخول</Button></Link>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark />
          <span>منصة M&amp;K</span>
        </div>

        <div className="auth-stepper">
          {STEPS.map((s, i) => (
            <Fragment key={s.key}>
              <div className="auth-step">
                <div className={`auth-step-dot${i <= step ? (i < step ? ' auth-step-dot--done' : ' auth-step-dot--active') : ''}`}>
                  {i < step ? <Icon name="check" /> : i + 1}
                </div>
                <span className={`auth-step-label${i <= step ? ' auth-step-label--active' : ''}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`auth-step-line${i < step ? ' auth-step-line--done' : ''}`} />
              )}
            </Fragment>
          ))}
        </div>

        {step === 0 && (
          <>
            <h1 className="auth-title">إنشاء الحساب</h1>
            <p className="auth-subtitle">أدخل بياناتك للبدء</p>
            <form onSubmit={submit}>
              <Input label="الاسم الكامل" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Input label="رقم الهاتف" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required placeholder="01xxxxxxxxx" autoComplete="tel" />
              <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required placeholder="you@example.com" autoComplete="email" />
              <Input label="كلمة المرور" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required placeholder="••••••••" autoComplete="new-password" />
              {error && <p className="field-error">{error}</p>}
              <Button type="button" block onClick={next} icon="arrow_forward">التالي</Button>
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
            <div className="plan-cards">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`plan-card${p.id === selectedPlan?.id ? ' plan-card--selected' : ''}`}
                  onClick={() => setPlanId(p.id)}
                >
                  <div className="plan-card-name">
                    <span>{p.name}</span>
                    {p.id === selectedPlan?.id && <Icon name="check_circle" />}
                  </div>
                  {p.description && <p className="plan-card-desc">{p.description}</p>}
                  <span className="plan-card-price">
                    {formatCurrency(p.priceMonthly)} <span className="muted">/ شهرياً</span>
                  </span>
                  {p.launchEnabled && Number(p.launchPrice) > 0 && (
                    <span className="plan-card-launch">أول شهر {formatCurrency(p.launchPrice)}</span>
                  )}
                  <span className="plan-card-trial">تجربة مجانية {Number(p.trialDays || 3)} أيام</span>
                </div>
              ))}
            </div>
            <div className="flex flex-gap-md">
              <Button variant="ghost" onClick={prev}>السابق</Button>
              <Button onClick={next} icon="arrow_forward">التالي</Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="auth-title">إعداد المتجر</h1>
            <p className="auth-subtitle">أدخل بيانات متجرك</p>
            <form onSubmit={submit}>
              <Input label="اسم المتجر" value={form.storeName} onChange={(v) => setForm({ ...form, storeName: v })} required />
              <Input label="الرابط المختصر" value={form.storeRef} onChange={(v) => setForm({ ...form, storeRef: v })} hint="اتركه فارغاً لاستخدام اسم المتجر" />
              {error && <p className="field-error">{error}</p>}
              <div className="flex flex-gap-md">
                <Button variant="ghost" type="button" onClick={prev}>السابق</Button>
                <Button type="submit" block loading={loading} icon="check">إنشاء الحساب</Button>
              </div>
            </form>
          </>
        )}

        <p className="auth-switch">لديك حساب بالفعل؟ <Link href="/login?role=merchant">سجّل الدخول</Link></p>
      </div>
    </AuthShell>
  )
}