import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { useLocation } from 'wouter'
import { applyActionCode, checkActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { auth } from '../../firebase'
import { reloadCurrentUser } from '../../services/auth'
import { useAuth } from '../../hooks/useAuth'
import { AuthShell } from './AuthShell'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

type ActionState = 'LOADING' | 'SUCCESS' | 'ALREADY_USED' | 'EXPIRED' | 'INVALID' | 'ERROR' | 'RESET_FORM' | 'RESET_SUCCESS'

const copy: Record<Exclude<ActionState, 'LOADING' | 'RESET_FORM'>, { title: string; body: string; icon: string }> = {
  SUCCESS: { title: 'تم تأكيد بريدك الإلكتروني بنجاح', body: 'تقدر الآن تكمل تسجيل الدخول واستخدام متجرك', icon: 'mark_email_read' },
  ALREADY_USED: { title: 'تم تأكيد هذا البريد بالفعل', body: 'يمكنك متابعة تسجيل الدخول إلى حسابك بأمان.', icon: 'verified' },
  EXPIRED: { title: 'انتهت صلاحية رابط التحقق', body: 'اطلب رابط تحقق جديدًا من شاشة التحقق من البريد.', icon: 'schedule' },
  INVALID: { title: 'رابط التحقق غير صالح', body: 'اطلب رابط تحقق جديدًا وتأكد من فتح أحدث رسالة.', icon: 'link_off' },
  ERROR: { title: 'تعذر إكمال التحقق الآن', body: 'حاول مرة أخرى بعد قليل أو اطلب رابط تحقق جديدًا.', icon: 'error' },
  RESET_SUCCESS: { title: 'تم تغيير كلمة المرور بنجاح', body: 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.', icon: 'lock_reset' },
}

const actionError = (error: unknown, checked: boolean): ActionState => {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
  if (code === 'auth/expired-action-code') return 'EXPIRED'
  if (code === 'auth/invalid-action-code') return checked ? 'ALREADY_USED' : 'INVALID'
  if (code === 'auth/network-request-failed') return 'ERROR'
  return 'ERROR'
}

export const EmailActionHandler: FunctionalComponent = () => {
  const [, navigate] = useLocation()
  const { user, refreshUser } = useAuth()
  const [state, setState] = useState<ActionState>('LOADING')
  const [resetCode, setResetCode] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(window.location.search)
    const mode = params.get('mode')
    const code = params.get('oobCode')
    if (!code || (mode !== 'verifyEmail' && mode !== 'resetPassword')) {
      setState('INVALID')
      return () => { cancelled = true }
    }
    if (mode === 'resetPassword') {
      void (async () => {
        try {
          const email = await verifyPasswordResetCode(auth, code)
          if (cancelled) return
          setResetCode(code)
          setResetEmail(email)
          setState('RESET_FORM')
        } catch (error) {
          if (!cancelled) setState(actionError(error, false))
        }
      })()
      return () => { cancelled = true }
    }
    void (async () => {
      let checked = false
      try {
        await checkActionCode(auth, code)
        checked = true
        await applyActionCode(auth, code)
        await reloadCurrentUser()
        await refreshUser()
        if (!cancelled) setState('SUCCESS')
      } catch (error) {
        if (!cancelled) setState(actionError(error, checked))
      }
    })()
    return () => { cancelled = true }
  }, [refreshUser])

  const submitNewPassword = async (e: Event) => {
    e.preventDefault()
    setResetError('')
    if (newPassword.length < 6) {
      setResetError('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    setResetLoading(true)
    try {
      await confirmPasswordReset(auth, resetCode, newPassword)
      setState('RESET_SUCCESS')
    } catch (error) {
      setState(actionError(error, true))
    } finally {
      setResetLoading(false)
    }
  }

  const current = state === 'LOADING' || state === 'RESET_FORM' ? null : copy[state]
  const goNext = () => {
    if (state === 'SUCCESS') {
      if (user || auth.currentUser) navigate('/dashboard/', { replace: true })
      else navigate('/login?role=merchant&verified=1', { replace: true })
      return
    }
    if (state === 'RESET_SUCCESS') {
      navigate('/login', { replace: true })
      return
    }
    navigate('/verify-email', { replace: true })
  }

  if (state === 'RESET_FORM') {
    return (
      <AuthShell variant="brand">
        <div className="auth-card" dir="rtl">
          <h2 className="auth-title">تعيين كلمة مرور جديدة</h2>
          <p className="auth-subtitle">لحسابك <strong>{resetEmail}</strong></p>
          <form onSubmit={submitNewPassword} className="auth-form">
            <div className="auth-form-field">
              <label htmlFor="new-password">كلمة المرور الجديدة</label>
              <div className="auth-input-wrap">
                <Icon name="lock" className="auth-input-icon" ariaHidden />
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onInput={(e) => setNewPassword((e.target as HTMLInputElement).value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
            </div>
            {resetError && <p className="field-error">{resetError}</p>}
            <Button type="submit" block loading={resetLoading} icon="lock_reset">
              تعيين كلمة المرور
            </Button>
          </form>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell variant="brand">
      <div className="auth-card email-action-card" dir="rtl">
        <div className={`auth-status-card email-action-state email-action-state--${state.toLowerCase()}`}>
          <div className="auth-status-icon"><Icon name={state === 'LOADING' ? 'hourglass_empty' : current!.icon} /></div>
          {state === 'LOADING' ? (
            <>
              <span className="auth-status-badge"><i className="auth-status-pulse" /> جارٍ التحقق</span>
              <h1 className="auth-title">نتحقق من بريدك الإلكتروني</h1>
              <p className="auth-subtitle">لحظات ونكمل تفعيل حسابك بأمان.</p>
            </>
          ) : (
            <>
              <span className="auth-status-badge"><i className="auth-status-pulse" /> Matjari</span>
              <h1 className="auth-title">{current.title}</h1>
              <p className="auth-subtitle">{current.body}</p>
              <Button block onClick={goNext} icon={state === 'SUCCESS' || state === 'RESET_SUCCESS' ? 'login' : state === 'ALREADY_USED' ? 'login' : 'mark_email_unread'}>
                {state === 'SUCCESS' || state === 'RESET_SUCCESS' ? 'الدخول إلى حسابي' : state === 'ALREADY_USED' ? 'تسجيل الدخول' : 'إعادة إرسال رابط التحقق'}
              </Button>
            </>
          )}
        </div>
      </div>
    </AuthShell>
  )
}

export default EmailActionHandler
