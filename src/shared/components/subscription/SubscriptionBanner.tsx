import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { useSubscription } from '../../hooks/useSubscription'
import { useStore } from '../../hooks/useStore'
import { formatDate } from '../../utils/format'
import { Icon } from '../ui/Icon'
import { CountdownTimer } from './CountdownTimer'

const DAY_MS = 86400000

/**
 * Reusable subscription status banner for the merchant dashboard.
 * Rendered once (in MerchantLayout) so every merchant page shares it.
 */
export const SubscriptionBanner: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const { subscription, plan, status, paymentRequests, loading } = useSubscription(storeId)

  if (loading || !subscription) return null

  const pendingRequest = paymentRequests.some((p) => p.status === 'pending')

  const content = (() => {
    if (pendingRequest) {
      return {
        tone: 'warn',
        icon: 'hourglass_top',
        message: 'طلب تفعيل الاشتراك قيد المراجعة',
        sub: 'سيتم تفعيل اشتراكك فور تأكيد عملية الدفع من إدارة المنصة.',
        cta: null,
      }
    }
    if (status === 'trialing') {
      const ends = subscription.trialEndsAt ? (subscription.trialEndsAt.seconds || 0) * 1000 : null
      const urgent = ends != null && ends - Date.now() < DAY_MS
      return {
        tone: urgent ? 'warn' : 'info',
        icon: urgent ? 'hourglass_top' : 'schedule',
        message: urgent ? 'تجربتك المجانية تنتهي قريبًا' : 'الفترة التجريبية نشطة',
        sub: `باقة ${plan?.name || subscription.planName || ''} — بكامل المزايا.`,
        cta: { label: 'فعّل الباقة', to: '/dashboard/subscription' },
      }
    }
    if (status === 'active') {
      return {
        tone: 'ok',
        icon: 'verified',
        message: `اشتراك ${plan?.name || subscription.planName || ''} نشط`,
        sub: subscription.currentPeriodEnd ? `حتى ${formatDate(subscription.currentPeriodEnd)}` : '',
        cta: null,
      }
    }
    if (status === 'expired') {
      return {
        tone: 'danger',
        icon: 'error',
        message: 'انتهت الفترة التجريبية — يلزم التفعيل',
        sub: 'بيانات متجرك محفوظة بالكامل. فعّل باقتك لاستكمال البيع.',
        cta: { label: 'فعّل الباقة', to: '/dashboard/subscription' },
      }
    }
    if (status === 'suspended') {
      return {
        tone: 'danger',
        icon: 'block',
        message: 'تم تعليق الاشتراك',
        sub: 'تواصل مع إدارة المنصة لمعرفة التفاصيل.',
        cta: null,
      }
    }
    return null
  })()

  if (!content) return null

  return (
    <div className={`sub-banner sub-banner--${content.tone}`} role="status">
      <Icon name={content.icon} />
      <div className="sub-banner-text">
        <strong>{content.message}</strong>
        {status === 'trialing' && subscription.trialEndsAt ? (
          <CountdownTimer endsAt={subscription.trialEndsAt} label="متبقي من الفترة التجريبية" className="sub-banner-countdown" />
        ) : status === 'trialing' ? (
          <span className="sub-banner-invalid-trial">تعذر تحديد موعد انتهاء التجربة</span>
        ) : null}
        {content.sub && <span>{content.sub}</span>}
      </div>
      <span className={`sub-banner-store-status sub-banner-store-status--${store?.published ? 'published' : 'draft'}`}>
        المتجر: {store?.published ? 'منشور' : 'مسودة'}
      </span>
      {content.cta && (
        <Link href={content.cta.to} className="btn btn-primary btn-sm">
          {content.cta.label}
        </Link>
      )}
    </div>
  )
}
