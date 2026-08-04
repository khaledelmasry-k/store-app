import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { useStore } from '../../shared/hooks/useStore'
import { useToast } from '../../shared/hooks/useToast'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { login, signupCustomer } from '../../shared/services/auth'
import { Link } from 'wouter'

export const StoreLogin: FunctionalComponent = () => {
  const { store } = useStore()
  const toast = useToast()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const submit = async (e: Event) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'signup') {
        if (form.password.length < 6) {
          toast.push('كلمة المرور 6 أحرف على الأقل', undefined, 'error')
          return
        }
        await signupCustomer(form.email, form.password, form.name)
        toast.push('تم إنشاء الحساب')
      } else {
        await login({ email: form.email, password: form.password })
        toast.push('تم تسجيل الدخول')
      }
      window.location.href = `/store/${store?.slug}/account`
    } catch {
      toast.push('تعذر تسجيل الدخول', 'تحقق من البيانات', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</h1>
        <p className="auth-subtitle">حساب العميل على {store?.name}</p>
        <form onSubmit={submit}>
          {mode === 'signup' && <Input label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />}
          <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
          <Input label="كلمة المرور" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
          <Button type="submit" block loading={loading}>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}</Button>
        </form>
        <p className="auth-switch">
          {mode === 'login' ? 'ليس لديك حساب؟ ' : 'لديك حساب؟ '}
          <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ color: 'var(--primary)', fontWeight: 600 }}>
            {mode === 'login' ? 'أنشئ حساباً' : 'سجّل الدخول'}
          </button>
        </p>
        <p className="auth-switch"><Link href={`/store/${store?.slug}`}>العودة للمتجر</Link></p>
      </div>
    </div>
  )
}
export default StoreLogin
