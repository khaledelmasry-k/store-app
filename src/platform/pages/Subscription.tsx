import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Loading } from '../../shared/components/ui/Loading'
import { useDocument } from '../../shared/hooks/useDocument'
import { getBillingSnapshotsCallable } from '../../shared/services/auth'
import { resolveSubscriptionStatus } from '../../shared/services/subscription'
import { formatCurrency, formatDate, formatNumber } from '../../shared/utils/format'
import { SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_TONES } from '../../shared/utils/constants'
import type { Subscription, Store, SubscriptionPlan } from '../../shared/types'

const BILLING_TYPE_LABELS: Record<string, string> = {
  activation: 'تفعيل الاشتراك',
  plan_change: 'تغيير الباقة',
  renewal: 'تجديد الاشتراك',
  manual: 'تعديل يدوي',
}

export const PlatformSubscriptionDetail: FunctionalComponent<{ id: string }> = ({ id }) => {
  const { data: sub, loading } = useDocument<Subscription>('subscriptions', id)
  const { data: store } = useDocument<Store>('stores', sub?.storeId)
  const { data: plan } = useDocument<SubscriptionPlan>('plans', sub?.planId)
  const [snapshots, setSnapshots] = useState<any[]>([])

  useEffect(() => {
    if (!sub?.storeId) return
    let active = true
    getBillingSnapshotsCallable({ storeId: sub.storeId })
      .then((r) => { if (active) setSnapshots((r.data as any)?.snapshots || []) })
      .catch(() => { if (active) setSnapshots([]) })
    return () => { active = false }
  }, [sub?.storeId])

  if (loading) return <Loading variant="screen" message="جارٍ تحميل تفاصيل الاشتراك..." />
  if (!sub) {
    return (
      <div className="platform-operations platform-subscription-detail-page">
        <PageHeader title="تفاصيل الاشتراك" />
        <Card><p className="muted">الاشتراك غير موجود.</p><Link href="/platform/subscriptions"><Button variant="ghost">العودة للقائمة</Button></Link></Card>
      </div>
    )
  }

  const status = resolveSubscriptionStatus(sub)
  const currency = store?.currency || 'SAR'
  const price = (n?: number) => (typeof n === 'number' ? formatCurrency(n, currency) : '—')

  return (
    <div>
      <PageHeader
        title={`اشتراك ${store?.name || 'متجر'}`}
        subtitle={`${plan?.name || sub.planName || sub.planId} • ${sub.billingCycle === 'yearly' ? 'سنوي' : 'شهري'}`}
        actions={<Link href="/platform/subscriptions" className="btn btn-ghost"><Button variant="ghost" icon="arrow_forward">العودة</Button></Link>}
      />

      <div className="grid grid-2">
        <Card title="حالة الاشتراك">
          <div className="list-row"><span>الحالة</span><Badge tone={SUBSCRIPTION_STATUS_TONES[status as keyof typeof SUBSCRIPTION_STATUS_TONES] || 'slate'}>{SUBSCRIPTION_STATUS_LABELS[status as keyof typeof SUBSCRIPTION_STATUS_LABELS] || status}</Badge></div>
          <div className="list-row"><span>الباقة</span><strong>{plan?.name || sub.planName || sub.planId}</strong></div>
          <div className="list-row"><span>دورة الفوترة</span><span>{sub.billingCycle === 'yearly' ? 'سنوي' : 'شهري'}</span></div>
          <div className="list-row"><span>رقم الدورة</span><span>{formatNumber(sub.periodNumber || 0)}</span></div>
          {sub.trialEndsAt && <div className="list-row"><span>انتهاء التجربة</span><span>{formatDate(sub.trialEndsAt)}</span></div>}
          {sub.currentPeriodEnd && <div className="list-row"><span>انتهاء الدورة الحالية</span><span>{formatDate(sub.currentPeriodEnd)}</span></div>}
          {sub.activatedAt && <div className="list-row"><span>تاريخ التفعيل</span><span>{formatDate(sub.activatedAt)}</span></div>}
          <div className="list-row"><span>الطلبات في الدورة</span><span>{formatNumber(sub.ordersUsed || 0)}</span></div>
        </Card>

        <Card title="التسعير المسجّل">
          <div className="list-row"><span>السعر العادي (شهري)</span><strong>{price(sub.normalPriceSnapshot)}</strong></div>
          <div className="list-row"><span>سعر الإطلاق (شهري)</span><strong>{price(sub.launchPriceSnapshot)}</strong></div>
          <div className="list-row"><span>السعر السنوي</span><strong>{price(sub.yearlyPriceSnapshot)}</strong></div>
          <div className="list-row"><span>خصم الإطلاق مُستخدم؟</span><span>{sub.launchUsed ? 'نعم' : 'لا'}</span></div>
          <div className="list-row"><span>العملة</span><span>{currency}</span></div>
        </Card>
      </div>

      <Card title="سجل الفوترة" className="mt-2">
        {snapshots.length === 0 ? (
          <p className="muted small">لا يوجد سجل فوترة لهذا الاشتراك بعد.</p>
        ) : (
          <div className="billing-history">
            {snapshots.map((s) => (
              <div key={s.id} className="billing-history-row">
                <div>
                  <strong>{BILLING_TYPE_LABELS[s.type] || s.type}</strong>
                  <span className="muted small"> — {s.planName || s.planId}</span>
                  {s.note && <p className="muted small mt-1">{s.note}</p>}
                </div>
                <div className="billing-history-meta">
                  <span>{formatCurrency(Number(s.priceMonthly || 0), currency)} / شهر</span>
                  <span className="muted small">{formatDate(s.at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
export default PlatformSubscriptionDetail
