import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { useStore } from '../../hooks/useStore'
import { useSubscription } from '../../hooks/useSubscription'
import { CountdownTimer } from './CountdownTimer'
import { Icon } from '../ui/Icon'
import { setStorePublishedCallable } from '../../services/auth'
import { useState } from 'preact/hooks'

export const MerchantStatusBar: FunctionalComponent = () => {
  const { store } = useStore()
  const [publishing, setPublishing] = useState(false)
  const storeId = store?.id || ''
  const sub = useSubscription(storeId)
  if (!store || sub.loading || !sub.subscription) return null

  const storeStatus = store.storeStatus || (store.published ? 'published' : 'draft')
  const planName = (sub.plan?.name || sub.subscription.planName || '—').toUpperCase()
  const isTrial = sub.status === 'trialing'
  const isExpired = sub.status === 'expired'
  const isPending = sub.paymentRequests.some((p) => p.status === 'pending')
  const canPublish = sub.status === 'active' || sub.status === 'trialing'
  const togglePublish = async () => {
    if (!canPublish || publishing) return
    setPublishing(true)
    try { await setStorePublishedCallable({ storeId, published: storeStatus !== 'published' }) } finally { setPublishing(false) }
  }

  let action: any = null
  if (isPending) action = <Link className="merchant-status-action" href="/dashboard/subscription">عرض حالة الدفع</Link>
  else if (isTrial || isExpired) action = <Link className="merchant-status-action" href="/dashboard/subscription">فعّل الباقة</Link>
  else if (storeStatus === 'draft' && canPublish) action = <button type="button" className="merchant-status-action" onClick={togglePublish} disabled={publishing}>{publishing ? 'جارٍ التحديث...' : 'نشر المتجر'}</button>

  return (
    <section data-tour="merchant-status" className={`merchant-status-bar merchant-status-bar--${isTrial ? 'trial' : isExpired ? 'expired' : 'active'}`} aria-label="حالة المتجر والاشتراك">
      <div className="merchant-status-main">
        <div className="merchant-status-heading"><Icon name={isTrial ? 'hourglass_top' : isExpired ? 'error' : 'verified'} ariaHidden /><strong>{isTrial ? 'تجربتك المجانية' : isExpired ? 'انتهت الفترة التجريبية' : `اشتراك ${planName} نشط`}</strong></div>
        {isTrial && (sub.subscription.trialEndsAt ? <span data-tour="trial-countdown"><CountdownTimer endsAt={sub.subscription.trialEndsAt} label="متبقي من الفترة التجريبية" className="merchant-status-countdown" /></span> : <span className="merchant-status-missing">تعذر تحديد موعد انتهاء التجربة</span>)}
      </div>
      <div className="merchant-status-meta"><span className="merchant-status-plan">{planName}</span><span className={`merchant-status-store merchant-status-store--${storeStatus}`}>{storeStatus === 'published' ? 'منشور' : storeStatus === 'suspended' ? 'موقوف' : 'مسودة'}</span></div>
      {action}
    </section>
  )
}
