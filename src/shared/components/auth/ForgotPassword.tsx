import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { resetPassword } from '../../services/auth'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { AuthShell } from './AuthShell'
import { isEmailValid } from '../../utils/validators'
import { Icon } from '../ui/Icon'

export const ForgotPassword: FunctionalComponent = () => {
  useEffect(() => {
    document.title = 'Matjari | استعادة كلمة المرور'
  }, [])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const toast = useToast()

  const onSubmit = async (e: Event) => {
    e.preventDefault()
    setError('')
    if (!isEmailValid(email)) {
      setError('يرجى إدخال بريد إلكتروني صالح')
      return
    }
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
      toast.push('تم إرسال الرابط', 'تفقّد بريدك الإلكتروني لإعادة تعيين كلمة المرور', 'success')
    } catch {
      setError('تعذّر إرسال رابط إعادة التعيين. تحقق من البريد الإلكتروني.')
      toast.push('فشل الإرسال', undefined, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="auth-card">
        {sent ? (
          <div className="auth-status-card">
            <div className="auth-status-icon">
              <Icon name="mark_email_read" />
            </div>
            <span className="auth-status-badge">
              <i className="auth-status-pulse" />
              تم الإرسال
            </span>
            <h2 className="auth-title">تم إرسال الرابط بنجاح</h2>
            <p className="auth-subtitle">لقد أرسلنا تعليمات إعادة تعيين كلمة المرور إلى <strong>{email}</strong>. يرجى التحقق من صندوق الوارد الخاص بك.</p>
            <Link href="/login">
              <Button variant="outline" block>العودة لتسجيل الدخول</Button>
            </Link>
            <button type="button" className="auth-retry" onClick={() => { setSent(false); setEmail('') }}>
              لم تستلم البريد؟ حاول مرة أخرى
            </button>
          </div>
        ) : (
          <>
            <h2 className="auth-title">نسيت كلمة المرور</h2>
            <p className="auth-subtitle">أدخل بريدك الإلكتروني المسجل لدينا وسنرسل لك رابطاً لإعادة تعيين كلمة المرور الخاصة بك.</p>
            <form onSubmit={onSubmit} className="auth-form">
              <div className="auth-form-field">
                <label htmlFor="forgot-email">البريد الإلكتروني</label>
                <div className="auth-input-wrap">
                  <Icon name="mark_email_unread" className="auth-input-icon" ariaHidden />
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>
              {error && <p className="field-error">{error}</p>}
              <Button type="submit" block loading={loading} icon="arrow_forward">
                إرسال رابط إعادة التعيين
              </Button>
            </form>
            <Link href="/login" className="auth-back-link">
              <Icon name="arrow_back" ariaHidden />
              العودة لتسجيل الدخول
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  )
}

export default ForgotPassword
