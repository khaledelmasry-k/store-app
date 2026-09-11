import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { useLocation } from 'wouter'
import { applyActionCode, checkActionCode } from 'firebase/auth'
import { auth } from '../../firebase'
import { reloadCurrentUser } from '../../services/auth'
import { useAuth } from '../../hooks/useAuth'
import { AuthShell } from './AuthShell'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

type ActionState = 'LOADING' | 'SUCCESS' | 'ALREADY_USED' | 'EXPIRED' | 'INVALID' | 'ERROR'

const copy: Record<Exclude<ActionState, 'LOADING'>, { title: string; body: string; icon: string }> = {
  SUCCESS: { title: 'تم تأكيد بريدك الإلكتروني بنجاح', body: 'تقدر الآن تكمل تسجيل الدخول واستخدام متجرك', icon: 'mark_email_read' },
  ALREADY_USED: { title: 'تم تأكيد هذا البريد بالفعل', body: 'يمكنك متابعة تسجيل الدخول إلى حسابك بأمان.', icon: 'verified' },
  EXPIRED: { title: 'انتهت صلاحية رابط التحقق', body: 'اطلب رابط تحقق جديدًا من شاشة التحقق من البريد.', icon: 'schedule' },
  INVALID: { title: 'رابط التحقق غير صالح', body: 'اطلب رابط تحقق جديدًا وتأكد من فتح أحدث رسالة.', icon: 'link_off' },
  ERROR: { title: 'تعذر إكمال التحقق الآن', body: 'حاول مرة أخرى بعد قليل أو اطلب رابط تحقق جديدًا.', icon: 'error' },
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

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(window.location.search)
    const mode = params.get('mode')
    const code = params.get('oobCode')
    if (mode !== 'verifyEmail' || !code) {
      setState('INVALID')
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

  const current = state === 'LOADING' ? null : copy[state]
  const goNext = () => {
    if (state === 'SUCCESS') {
      if (user || auth.currentUser) navigate('/dashboard/', { replace: true })
      else navigate('/login?role=merchant&verified=1', { replace: true })
      return
    }
    navigate('/verify-email', { replace: true })
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
              <Button block onClick={goNext} icon={state === 'SUCCESS' ? 'login' : state === 'ALREADY_USED' ? 'login' : 'mark_email_unread'}>
                {state === 'SUCCESS' ? 'الدخول إلى حسابي' : state === 'ALREADY_USED' ? 'تسجيل الدخول' : 'إعادة إرسال رابط التحقق'}
              </Button>
            </>
          )}
        </div>
      </div>
    </AuthShell>
  )
}

export default EmailActionHandler
