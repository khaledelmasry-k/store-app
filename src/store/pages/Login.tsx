import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link, useLocation, useParams } from 'wouter'
import { useAuth } from '../../shared/hooks/useAuth'
import { useToast } from '../../shared/hooks/useToast'
import { useStore } from '../../shared/hooks/useStore'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { MerchantLogo } from '../../shared/components/brand/MerchantLogo'
import { Icon } from '../../shared/components/ui/Icon'
import { login, signupCustomer } from '../../shared/services/auth'

export const StoreLogin: FunctionalComponent = () => {
  const { store } = useStore()
  const { loading: authLoading } = useAuth()
  const toast = useToast()
  const [, navigate] = useLocation()
  const params = useParams<{ mode?: string; order?: string; phone?: string }>()

  const mode = params.mode || 'login'
  const redirectOrder = params.order
  const redirectPhone = params.phone

  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState(redirectPhone || '')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const isSignup = mode === 'signup'

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (isSignup) {
      if (!name || !phone || !password) {
        toast.push('أكمل جميع الحقول', undefined, 'error')
        return
      }
      setLoading(true)
      try {
        await signupCustomer(phone, password, name, phone)
        toast.push('تم إنشاء الحساب بنجاح')
        if (redirectOrder) {
          navigate(`/store/${store?.slug}/account?tab=orders`)
        } else {
          navigate(`/store/${store?.slug}/account`)
        }
      } catch (err: any) {
        toast.push('فشل إنشاء الحساب', err?.message || 'حاول مرة أخرى', 'error')
      } finally {
        setLoading(false)
      }
    } else {
      if (!phone || !password) {
        toast.push('أدخل رقم الهاتف وكلمة المرور', undefined, 'error')
        return
      }
      setLoading(true)
      try {
        await login({ email: phone, password })
        toast.push('مرحباً بعودتك!')
        if (redirectOrder) {
          navigate(`/store/${store?.slug}/account?tab=orders`)
        } else {
          navigate(`/store/${store?.slug}/account`)
        }
      } catch (err: any) {
        toast.push('فشل تسجيل الدخول', err?.message || 'تحقق من بياناتك', 'error')
      } finally {
        setLoading(false)
      }
    }
  }

  const switchMode = () => {
    navigate(`/store/${store?.slug}/login?mode=${isSignup ? 'login' : 'signup'}${redirectOrder ? `&order=${redirectOrder}` : ''}${redirectPhone ? `&phone=${redirectPhone}` : ''}`)
  }

  return (
    <div className="storefront-page storefront-login storefront-login--stitch">
      <div className="auth-container">
        <div className="auth-context"><Icon name="verified_user" ariaHidden /><span>تجربة تسوق آمنة وخصوصية كاملة</span></div>
        <div className="auth-card">
          <div className="auth-header">
            <Link href={`/store/${store?.slug}`} className="auth-brand">
              <MerchantLogo store={store} variant="header" />
            </Link>
          </div>

          <div className="auth-tabs">
            <button
              className={`auth-tab${!isSignup ? ' active' : ''}`}
              onClick={switchMode}
            >
              تسجيل الدخول
            </button>
            <button
              className={`auth-tab${isSignup ? ' active' : ''}`}
              onClick={switchMode}
            >
              إنشاء حساب
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {isSignup && (
              <div className="auth-field">
                <label>الاسم بالكامل</label>
                <Input
                  value={name}
                  onChange={setName}
                  placeholder="أحمد محمد"
                  required
                />
              </div>
            )}

            <div className="auth-field">
              <label>رقم الهاتف</label>
              <Input
                type="tel"
                value={phone}
                onChange={setPhone}
                placeholder="01xxxxxxxxx"
                required
              />
            </div>

            <div className="auth-field">
              <label>كلمة المرور</label>
              <div className="password-input">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  placeholder="كلمة المرور"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                </button>
              </div>
            </div>

            {isSignup && (
              <label className="checkbox-label">
                <input type="checkbox" required />
                <span>أوافق على <a href="#">الشروط والأحكام</a> و <a href="#">سياسة الخصوصية</a></span>
              </label>
            )}

            <Button type="submit" block size="lg" loading={loading || authLoading} className="auth-submit">
              {isSignup ? 'إنشاء حساب' : 'تسجيل الدخول'}
            </Button>
          </form>

          <p className="auth-footer">
            {isSignup ? 'لديك حساب بالفعل؟' : 'لا تملك حساب؟'}
            <button className="auth-link" onClick={switchMode}>
              {isSignup ? 'تسجيل الدخول' : 'إنشاء حساب'}
            </button>
          </p>

          {redirectOrder && (
            <div className="auth-redirect-notice">
              <Icon name="info" />
              <span>سيتم ربط الطلب <strong className="monospace">{redirectOrder}</strong> بحسابك الجديد</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default StoreLogin
