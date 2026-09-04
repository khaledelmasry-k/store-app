import { FunctionalComponent } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { Link, useLocation } from 'wouter'
import { login, logout } from '../../services/auth'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { AuthShell } from './AuthShell'
import { Icon } from '../ui/Icon'

interface Props {
  role: 'platform' | 'merchant' | 'customer'
}

const META = {
  platform: { title: 'بوابة مدير المنصة', redirect: '/platform/' },
  merchant: { title: 'تسجيل دخول التاجر', redirect: '/dashboard/' },
  customer: { title: 'تسجيل الدخول', redirect: '/' },
}

export const Login: FunctionalComponent<Props> = ({ role }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const navigatedRef = useRef(false)
  const meta = META[role]
  const toast = useToast()
  const { user, initialized } = useAuth()
  const [loc, navigate] = useLocation()
  const loginParams = new URLSearchParams(loc.split('?')[1] || window.location.search)
  const queryLifetimeIntent = role === 'merchant' && loginParams.get('offer') === 'lifetime'
  const [storedLifetimeIntent, setStoredLifetimeIntent] = useState(false)

  useEffect(() => {
    if (role !== 'merchant' || queryLifetimeIntent) return
    try {
      setStoredLifetimeIntent(sessionStorage.getItem('matjari:onboarding-offer') === 'lifetime')
    } catch {
      setStoredLifetimeIntent(false)
    }
  }, [role, queryLifetimeIntent])

  const lifetimeIntent = queryLifetimeIntent || storedLifetimeIntent

  const merchantRedirect = useCallback(() => {
    const target = lifetimeIntent ? '/dashboard/subscription?offer=lifetime' : '/dashboard/'
    try {
      if (lifetimeIntent) sessionStorage.removeItem('matjari:onboarding-offer')
    } catch {
      // URL intent remains authoritative for this navigation.
    }
    return target
  }, [lifetimeIntent])

  useEffect(() => {
    document.title = `Matjari | ${meta.title}`
  }, [meta.title])

  useEffect(() => {
    if (!initialized || navigatedRef.current) return
    if (user) {
      navigatedRef.current = true
      if (user.role === 'superAdmin') { navigate('/platform/', { replace: true }) }
      else if (user.role === 'merchant' || user.role === 'staff') {
        if (user.active === false) {
          setPending(true)
          return
        }
        const target = merchantRedirect()
        navigate(target, { replace: true })
      }
      else if (user.role === 'customer') { navigate('/', { replace: true }) }
      else navigate('/dashboard/', { replace: true })
    }
  }, [user, initialized, navigate, merchantRedirect])

  const onSubmit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const submittedEmail = email.trim()
    try {
      await login({ email: submittedEmail, password })
      toast.push('تم تسجيل الدخول بنجاح', 'مرحبًا بعودتك', 'success')
    } catch (err) {
      const code = typeof err === 'object' && err && 'code' in err
        ? String((err as { code?: unknown }).code)
        : ''
      const message = code === 'auth/user-disabled'
        ? 'تم تعطيل هذا الحساب. تواصل مع إدارة المنصة للمساعدة.'
        : code === 'auth/too-many-requests'
          ? 'تم إيقاف المحاولات مؤقتًا. انتظر قليلًا ثم حاول مرة أخرى.'
          : code === 'auth/operation-not-allowed'
            ? 'تسجيل الدخول بالبريد الإلكتروني غير متاح حاليًا.'
            : code === 'auth/network-request-failed'
              ? 'تعذر الاتصال بالخدمة. تحقق من اتصال الإنترنت ثم حاول مجددًا.'
              : code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
                ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
                : 'تعذر تسجيل الدخول الآن. حاول مرة أخرى بعد قليل.'
      setError(message)
      toast.push('فشل تسجيل الدخول', message, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (pending) {
    return (
      <AuthShell>
        <div className="auth-card">
          <div className="auth-status-card">
            <div className="auth-status-icon">
              <Icon name="mark_email_unread" />
            </div>
            <span className="auth-status-badge">
              <i className="auth-status-pulse" />
              في انتظار المراجعة
            </span>
            <h1 className="auth-title">الحساب قيد المراجعة</h1>
            <p className="auth-subtitle">
              حسابك لم يتم تفعيله بعد. سيتم تفعيله فور موافقة إدارة المنصة على اشتراكك.
            </p>
            {user?.email && (
              <div className="auth-email-row">
                <Icon name="mark_email_read" ariaHidden />
                <span>{user.email}</span>
              </div>
            )}
            <Button variant="outline" block onClick={() => logout()}>
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <h1 className="auth-title">{meta.title}</h1>
        <p className="auth-subtitle">أدخل بياناتك للوصول إلى لوحة التحكم</p>
        <form onSubmit={onSubmit} className="auth-form">
          <div className="auth-form-field">
            <label htmlFor="auth-email">البريد الإلكتروني</label>
            <div className="auth-input-wrap">
              <Icon name="mark_email_unread" className="auth-input-icon" ariaHidden />
              <input
                id="auth-email"
                type="email"
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-form-field">
            <div className="auth-label-row">
              <label htmlFor="auth-password">كلمة المرور</label>
              <Link href="/forgot-password" className="auth-inline-link">نسيت كلمة المرور؟</Link>
            </div>
            <div className="auth-input-wrap">
              <Icon name="lock" className="auth-input-icon" ariaHidden />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
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
          </div>

          {error && <p className="field-error">{error}</p>}

          <label className="auth-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember((e.target as HTMLInputElement).checked)}
            />
            <span>تذكرني</span>
          </label>

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
    </AuthShell>
  )
}
