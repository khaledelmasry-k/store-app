import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { resetPassword } from '../../services/auth'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { isEmailValid } from '../../utils/validators'

export const ForgotPassword: FunctionalComponent = () => {
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
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="material-symbols-outlined">lock_reset</span>
          <span>منصة M&amp;K</span>
        </div>
        <h1 className="auth-title">نسيت كلمة المرور؟</h1>
        {sent ? (
          <div className="order-confirmed mt-2">
            <div className="big-check"><span className="material-symbols-outlined">mark_email_read</span></div>
            <p className="auth-subtitle">تم إرسال رابط إعادة تعيين كلمة المرور إلى <strong>{email}</strong>.</p>
            <Link href="/login"><Button variant="outline">العودة لتسجيل الدخول</Button></Link>
          </div>
        ) : (
          <>
            <p className="auth-subtitle">أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.</p>
            <form onSubmit={onSubmit}>
              <Input
                label="البريد الإلكتروني"
                type="email"
                value={email}
                onChange={setEmail}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
              {error && <p className="field-error">{error}</p>}
              <Button type="submit" block loading={loading}>
                إرسال رابط التعيين
              </Button>
            </form>
            <p className="auth-switch">
              تذكرت كلمة المرور؟ <Link href="/login">تسجيل الدخول</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default ForgotPassword
