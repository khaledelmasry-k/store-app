import { FunctionalComponent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Link, useLocation } from 'wouter'
import { login, logout } from '../../services/auth'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface Props {
  role: 'platform' | 'merchant' | 'customer'
}

const META = {
  platform: { title: 'بوابة مدير المنصة', icon: 'admin_panel_settings', brand: 'منصة M&K', redirect: '/platform/' },
  merchant: { title: 'تسجيل دخول التاجر', icon: 'storefront', brand: 'متجر M&K', redirect: '/dashboard/' },
  customer: { title: 'تسجيل الدخول', icon: 'person', brand: 'حساب العميل', redirect: '/' },
}

export const Login: FunctionalComponent<Props> = ({ role }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const navigatedRef = useRef(false)
  const meta = META[role]
  const toast = useToast()
  const { user, initialized } = useAuth()
  const [, navigate] = useLocation()

  useEffect(() => {
    if (!initialized || navigatedRef.current) return
    if (user) {
      navigatedRef.current = true
      if (user.role === 'superAdmin') navigate('/platform/', { replace: true })
      else if (user.role === 'merchant' || user.role === 'staff') {
        if (user.active === false) {
          setPending(true)
          return
        }
        navigate('/dashboard/', { replace: true })
      }
      else if (user.role === 'customer') navigate('/', { replace: true })
      else navigate('/', { replace: true })
    }
  }, [user, initialized, navigate])

  const onSubmit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ email, password })
    } catch {
      setError('بيانات الدخول غير صحيحة أو الحساب غير مفعل بعد')
      toast.push('فشل تسجيل الدخول', 'تحقق من البريد وكلمة المرور', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (pending) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="order-confirmed">
            <div className="big-check">
              <span className="material-symbols-outlined">hourglass_top</span>
            </div>
            <h1 className="auth-title">الحساب قيد المراجعة</h1>
            <p className="auth-subtitle">
              حسابك لم يتم تفعيله بعد. سيتم تفعيله فور موافقة إدارة المنصة على اشتراكك.
            </p>
            <button className="btn btn-outline" onClick={() => logout()}>
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="material-symbols-outlined">{meta.icon}</span>
          <span>{meta.brand}</span>
        </div>
        <h1 className="auth-title">{meta.title}</h1>
        <p className="auth-subtitle">أدخل بياناتك للوصول إلى لوحة التحكم</p>
        <form onSubmit={onSubmit}>
          <Input label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} required placeholder="you@example.com" autoComplete="email" />
          <Input label="كلمة المرور" type="password" value={password} onChange={setPassword} required placeholder="••••••••" autoComplete="current-password" />
          <div className="flex-between mb-1" style={{ fontSize: '0.85rem' }}>
            <span />
            <Link href="/forgot-password" className="muted-link">نسيت كلمة المرور؟</Link>
          </div>
          {error && <p className="field-error">{error}</p>}
          <Button type="submit" block loading={loading}>
            تسجيل الدخول
          </Button>
        </form>
        {role === 'merchant' && (
          <p className="auth-switch">
            ليس لديك حساب؟ <Link href="/register">سجّل الآن</Link>
          </p>
        )}
        {role === 'customer' && (
          <p className="auth-switch">
            ليس لديك حساب؟ <Link href="/register">أنشئ حساباً</Link>
          </p>
        )}
      </div>
    </div>
  )
}