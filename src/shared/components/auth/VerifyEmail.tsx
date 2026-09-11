import { FunctionalComponent } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { Link, Redirect, useLocation } from 'wouter'
import { auth } from '../../firebase'
import { logout, reloadCurrentUser, sendVerificationEmail } from '../../services/auth'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { AuthShell } from './AuthShell'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

const maskEmail = (email: string) => {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${visible}${'•'.repeat(Math.max(2, local.length - visible.length))}@${domain}`
}

const errorMessage = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
  if (code === 'auth/too-many-requests') return 'تم تجاوز عدد المحاولات. انتظر قليلًا ثم أعد الإرسال.'
  if (code === 'auth/network-request-failed') return 'تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مرة أخرى.'
  if (code === 'auth/user-not-found') return 'انتهت جلسة الحساب. سجّل الدخول مرة أخرى.'
  return 'تعذر تنفيذ العملية الآن. حاول مرة أخرى بعد قليل.'
}

export const VerifyEmail: FunctionalComponent = () => {
  const { user, initialized, refreshUser } = useAuth()
  const toast = useToast()
  const [, navigate] = useLocation()
  const [cooldown, setCooldown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!cooldown) return
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const email = auth.currentUser?.email || user?.email || ''
  const maskedEmail = useMemo(() => maskEmail(email), [email])

  if (initialized && !auth.currentUser && !user) return <Redirect to="/login?role=merchant" replace />
  if (initialized && user && user.role !== 'merchant') return <Redirect to="/" replace />
  const pendingMarker = (() => { try { return sessionStorage.getItem('matjari:email-verification-pending') === '1' } catch { return false } })()
  if (initialized && user && user.role === 'merchant' && !user.emailVerificationRequired && !pendingMarker) return <Redirect to="/dashboard/" replace />

  const resend = async () => {
    if (cooldown || loading) return
    setLoading(true)
    setMessage('')
    try {
      await sendVerificationEmail()
      setCooldown(60)
      setMessage('تم إرسال رسالة تحقق جديدة. افحص صندوق الوارد والبريد غير المرغوب فيه.')
      toast.push('تم إرسال رسالة التحقق', undefined, 'success')
    } catch (error) {
      const text = errorMessage(error)
      setMessage(text)
      toast.push('تعذر إرسال رسالة التحقق', text, 'error')
    } finally {
      setLoading(false)
    }
  }

  const checkVerification = async () => {
    setLoading(true)
    setMessage('')
    try {
      const current = await reloadCurrentUser()
      await refreshUser()
      if (current?.emailVerified || auth.currentUser?.emailVerified) {
        try { sessionStorage.removeItem('matjari:email-verification-pending') } catch { /* storage may be unavailable */ }
        toast.push('تم التحقق من البريد الإلكتروني', undefined, 'success')
        navigate('/dashboard/', { replace: true })
      } else {
        setMessage('لم يكتمل التحقق بعد. افتح الرابط المرسل إلى بريدك ثم اضغط الزر مرة أخرى.')
      }
    } catch (error) {
      const text = errorMessage(error)
      setMessage(text)
      toast.push('تعذر تحديث حالة التحقق', text, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="auth-card email-verification-card">
        <div className="auth-status-card">
          <div className="auth-status-icon"><Icon name="mark_email_unread" /></div>
          <span className="auth-status-badge"><i className="auth-status-pulse" /> تحقق مطلوب</span>
          <h1 className="auth-title">تحقق من بريدك الإلكتروني</h1>
          <p className="auth-subtitle">أرسلنا رابط التحقق إلى بريدك. افتح الرابط لتفعيل حساب التاجر ومتابعة إعداد متجرك.</p>
          <p className="auth-hint">قد تصل الرسالة إلى Inbox أو البريد غير المرغوب فيه (Spam/Junk).</p>
          {maskedEmail && <div className="auth-email-row"><Icon name="mail" ariaHidden /><span dir="ltr">{maskedEmail}</span></div>}
          {message && <p className="field-error email-verification-message" role="status">{message}</p>}
          <div className="email-verification-actions">
            <Button block loading={loading} disabled={cooldown > 0} onClick={resend} icon="mark_email_unread">
              {cooldown ? `إعادة الإرسال بعد ${cooldown} ثانية` : 'إعادة إرسال رسالة التحقق'}
            </Button>
            <Button block variant="outline" loading={loading} onClick={checkVerification} icon="refresh">
              تحققت من البريد
            </Button>
          </div>
          <div className="email-verification-links">
            <Link href="/forgot-password">نسيت كلمة المرور؟</Link>
            <button type="button" className="auth-retry" onClick={() => { try { sessionStorage.removeItem('matjari:email-verification-pending') } catch { /* storage may be unavailable */ } void logout() }}>تسجيل الخروج / تغيير الحساب</button>
          </div>
        </div>
      </div>
    </AuthShell>
  )
}

export default VerifyEmail
