import { FunctionalComponent } from 'preact'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Progress } from '../../shared/components/ui/Progress'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { formatCurrency, formatDate, formatNumber } from '../../shared/utils/format'
import {
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_TONES,
  ORDER_USAGE_LABELS,
  ORDER_USAGE_TONES,
  usageLevelFor,
} from '../../shared/utils/constants'
import type { Subscription, SubscriptionPlan } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'

function daysUntil(input?: { seconds: number; nanoseconds: number } | null): number | null {
  if (!input) return null
  return Math.max(0, Math.ceil((input.seconds * 1000 - Date.now()) / 86400000))
}

export const MerchantSubscription: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const subsRes = useCollection<Subscription>('subscriptions', { storeId })
  const plansRes = useCollection<SubscriptionPlan>('plans', {})
  const subs = subsRes.data
  const plans = plansRes.data

  if (subsRes.loading || plansRes.loading) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>

  const latestSub = [...subs].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0]
  const plan = latestSub ? plans.find((p) => p.id === latestSub.planId) : null

  if (!latestSub) {
    return (
      <div>
        <PageHeader title="الاشتراك" subtitle="اشتراك متجرك" />
        <Card>
          <EmptyState
            icon="card_membership"
            title="لا يوجد اشتراك"
            description="لم يتم إنشاء اشتراك لمتجرك بعد. يرجى التواصل مع مدير المنصة لتفعيله."
          />
        </Card>
      </div>
    )
  }

  const orderLimit = plan?.orderLimitPerMonth || 0
  const ordersUsed = latestSub.ordersUsed || 0
  const usagePercent = orderLimit > 0 ? Math.min(100, Math.round((ordersUsed / orderLimit) * 100)) : 0
  const usageLevel = usageLevelFor(usagePercent, orderLimit > 0)
  const remaining = orderLimit > 0 ? Math.max(0, orderLimit - ordersUsed) : null
  const daysLeft = daysUntil(latestSub.expiresAt)

  return (
    <div>
      <PageHeader title="الاشتراك" subtitle="تفاصيل باقة متجرك واستخدامها" />

      <div className="grid grid-2">
        <Card title="معلومات الاشتراك">
          <div className="list-row"><span>الباقة</span><strong>{plan?.name || latestSub.planName || '—'}</strong></div>
          <div className="list-row"><span>السعر الشهري</span><span>{plan ? formatCurrency(plan.priceMonthly) : '—'}</span></div>
          <div className="list-row"><span>الحالة</span><Badge tone={SUBSCRIPTION_STATUS_TONES[latestSub.status] || 'slate'}>{SUBSCRIPTION_STATUS_LABELS[latestSub.status] || latestSub.status}</Badge></div>
          <div className="list-row"><span>بداية الاشتراك</span><span>{formatDate(latestSub.startedAt)}</span></div>
          <div className="list-row"><span>ينتهي في</span><span>{formatDate(latestSub.expiresAt)}{daysLeft !== null && <span className="muted small"> ({daysLeft} يوم متبقٍ)</span>}</span></div>
        </Card>

        <Card title="استخدام الطلبات">
          {orderLimit > 0 ? (
            <div>
              <div className="flex-between mb-1">
                <span className="font-semibold">{formatNumber(ordersUsed)} من {formatNumber(orderLimit)} طلب</span>
                <Badge tone={ORDER_USAGE_TONES[usageLevel]}>{ORDER_USAGE_LABELS[usageLevel]}</Badge>
              </div>
              <Progress value={ordersUsed} max={orderLimit} tone={usageLevel === 'reached' ? 'red' : usageLevel === 'near' || usageLevel === 'approaching' ? 'amber' : usageLevel === 'moderate' ? 'primary' : 'green'} />
              <div className="summary-row">
                <span>نسبة الاستخدام</span>
                <strong>{usagePercent}%</strong>
              </div>
              <div className="summary-row">
                <span>الطلبات المتبقية</span>
                <strong>{formatNumber(remaining ?? 0)}</strong>
              </div>
              <p className="muted small mt-2">
                {usageLevel === 'reached'
                  ? 'لقد استنفدت حد الطلبات لهذه الدورة. تواصل مع مدير المنصة لترقية الباقة.'
                  : `لديك ${formatNumber(remaining ?? 0)} طلب متبقي من أصل ${formatNumber(orderLimit)} في هذه الدورة.`}
              </p>
            </div>
          ) : (
            <div>
              <p className="font-semibold">حد الطلبات غير محدد</p>
              <p className="muted small">باقتك الحالية لا تفرض حداً على عدد الطلبات الشهرية.</p>
            </div>
          )}
        </Card>
      </div>

      {plan?.features?.length ? (
        <Card title="مميزات الباقة" className="mt-2">
          <ul className="plan-pricing-features">
            {plan.features.map((f, i) => (
              <li key={i}>
                <Icon name="check_circle" />
                {f}
              </li>
            ))}
            <li>
              <Icon name="inventory_2" />
              حتى {plan.productLimit} منتج
            </li>
            <li>
              <Icon name="receipt_long" />
              {plan.orderLimitPerMonth > 0 ? `حتى ${plan.orderLimitPerMonth} طلب شهرياً` : 'طلبات غير محدودة'}
            </li>
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
export default MerchantSubscription
