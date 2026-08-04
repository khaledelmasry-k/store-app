import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link, useLocation } from 'wouter'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { registerMerchant } from '../../services/auth'
import { useToast } from '../../hooks/useToast'
import { useCollection } from '../../hooks/useCollection'
import { formatCurrency } from '../../utils/format'
import { isEmailValid } from '../../utils/validators'
import type { SubscriptionPlan } from '../../types'

export const Register: FunctionalComponent = () => {
  const [loc] = useLocation()
  const params = new URLSearchParams(loc.split('?')[1] || window.location.search)
  const planId = params.get('plan') || undefined
  const plansRes = useCollection<SubscriptionPlan>('plans', {})
  const selectedPlan = planId ? plansRes.data.find((p) => p.id === planId) : undefined

  const toast = useToast()
  const [form, setForm] = useState({ email: '', password: '', name: '', storeName: '', storeRef: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: Event) => {
    e.preventDefault()
    setError('')
    if (!isEmailValid(form.email)) return setError('بريد إلكتروني غير صالح')
    if (form.password.length < 6) return setError('كلمة المرور 6 أحرف على الأقل')
    if (!form.name.trim() || !form.storeName.trim()) return setError('أدخل الاسم واسم المتجر')
    setLoading(true)
    try {
      await registerMerchant({
        email: form.email,
        password: form.password,
        name: form.name.trim(),
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
      <div className="auth-screen">
        <div className="auth-card">
          <div className="order-confirmed">
            <div className="big-check"><span className="material-symbols-outlined">check</span></div>
            <h1 className="auth-title">تم تقديم طلب التسجيل</h1>
            <p className="auth-subtitle">طلبك قيد المراجعة من إدارة المنصة. ستتلقى بيانات الدخول بعد الموافقة على اشتراكك.</p>
            <Link href="/login?role=merchant"><Button variant="outline">العودة لتسجيل الدخول</Button></Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="material-symbols-outlined">storefront</span>
          <span>منصة M&K</span>
        </div>
        <h1 className="auth-title">تسجيل تاجر جديد</h1>
        <p className="auth-subtitle">أنشئ حسابك وابدأ بيع منتجاتك</p>
        {selectedPlan && (
          <div className="plan-selected">
            <span className="material-symbols-outlined">workspace_premium</span>
            <div>
              <strong>الباقة المختارة: {selectedPlan.name}</strong>
              <span className="muted small">
                {selectedPlan.priceMonthly === 0 ? 'مجاناً' : `${formatCurrency(selectedPlan.priceMonthly)} / شهرياً`}
                {' — '}سيتم تفعيلها بعد موافقة إدارة المنصة
              </span>
            </div>
          </div>
        )}
        <form onSubmit={submit}>
          <Input label="الاسم الكامل" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
          <Input label="كلمة المرور" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
          <Input label="اسم المتجر" value={form.storeName} onChange={(v) => setForm({ ...form, storeName: v })} required />
          <Input label="الرابط المختصر" value={form.storeRef} onChange={(v) => setForm({ ...form, storeRef: v })} hint="اتركه فارغاً لاستخدام اسم المتجر" />
          {error && <p className="field-error">{error}</p>}
          <Button type="submit" block loading={loading}>إنشاء الحساب</Button>
        </form>
        <p className="auth-switch">لديك حساب بالفعل؟ <Link href="/login?role=merchant">سجّل الدخول</Link></p>
      </div>
    </div>
  )
}
