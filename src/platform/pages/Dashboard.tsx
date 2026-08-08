import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Table } from '../../shared/components/ui/Table'
import { BarChart } from '../../shared/components/charts/BarChart'
import { DonutChart } from '../../shared/components/charts/DonutChart'
import { Button } from '../../shared/components/ui/Button'
import { useCollection } from '../../shared/hooks/useCollection'
import { usePlatformOverview } from '../../shared/hooks/usePlatformOverview'
import { useToast } from '../../shared/hooks/useToast'
import { Loading } from '../../shared/components/ui/Loading'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { timeAgo } from '../../shared/utils/format'
import { approveSubscriptionCallable } from '../../shared/services/auth'
import {
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_TONES,
  ORDER_USAGE_LABELS,
  ORDER_USAGE_TONES,
} from '../../shared/utils/constants'
import type { Store, Subscription, SubscriptionPlan, PlatformMerchantRow } from '../../shared/types'

function needsAttention(r: PlatformMerchantRow): boolean {
  return r.subStatus === 'pending' || r.subStatus === 'expired' || r.usageLevel === 'reached' || r.usageLevel === 'near' || r.usageLevel === 'approaching'
}

function attentionReason(r: PlatformMerchantRow): { label: string; tone: string } {
  if (r.subStatus === 'pending') return { label: 'بانتظار الموافقة', tone: 'amber' }
  if (r.usageLevel === 'reached') return { label: 'استنفد حد الطلبات', tone: 'red' }
  if (r.usageLevel === 'near' || r.usageLevel === 'approaching') return { label: ORDER_USAGE_LABELS[r.usageLevel], tone: ORDER_USAGE_TONES[r.usageLevel] }
  return { label: 'اشتراك منتهي', tone: 'red' }
}

export const PlatformDashboard: FunctionalComponent = () => {
  const storesRes = useCollection<Store>('stores', { orderBy: { field: 'createdAt' } })
  const subsRes = useCollection<Subscription>('subscriptions', { orderBy: { field: 'createdAt' } })
  const plansRes = useCollection<SubscriptionPlan>('plans', { orderBy: { field: 'priceMonthly' } })
  const { rows, loading: overviewLoading } = usePlatformOverview()
  const toast = useToast()

  const stores = storesRes.data
  const subs = subsRes.data
  const plans = plansRes.data

  if (storesRes.loading || subsRes.loading || plansRes.loading) {
    return <Loading />
  }

  const activeStores = stores.filter((s) => s.active).length
  const suspendedStores = stores.filter((s) => !s.active).length
  const activeSubs = subs.filter((s) => s.status === 'active').length
  const pendingSubs = subs.filter((s) => s.status === 'pending').length

  const attention = rows.filter(needsAttention).sort((a, b) => {
    const order: Record<string, number> = { none: 6, normal: 6, moderate: 6, reached: 0, near: 1, approaching: 2, pending: 3, expired: 4 }
    return (order[a.usageLevel] ?? 5) - (order[b.usageLevel] ?? 5)
  })
  const reachedCount = rows.filter((r) => r.usageLevel === 'reached').length
  const nearCount = rows.filter((r) => r.usageLevel === 'near' || r.usageLevel === 'approaching').length

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - i))
    return d
  })
  const merchantGrowthSeries = last6Months.map((month) =>
    stores.filter((s) => {
      const created = new Date((s.createdAt?.seconds || 0) * 1000)
      return created.getFullYear() === month.getFullYear() && created.getMonth() === month.getMonth()
    }).length,
  )

  const subStatusLabels = SUBSCRIPTION_STATUS_LABELS as Record<string, string>
  const subStatusColors: Record<string, string> = { active: 'var(--success)', pending: 'var(--warning)', expired: 'var(--danger)', cancelled: 'var(--border-strong)', rejected: 'var(--danger)' }
  const subDonut = (Object.keys(subStatusLabels) as (keyof typeof subStatusLabels)[])
    .map((k) => ({ label: subStatusLabels[k], value: subs.filter((s) => s.status === k).length, color: subStatusColors[k] }))
    .filter((s) => s.value > 0)

  const latestStores = [...stores].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5)
  const latestSubs = [...subs].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5)

  const approve = async (r: PlatformMerchantRow) => {
    if (!r.subId) return
    try {
      await approveSubscriptionCallable({ subscriptionId: r.subId })
      toast.push('تمت الموافقة على الاشتراك', `تم تفعيل حساب ${r.storeName}`, 'success')
    } catch (err: any) {
      toast.push('فشل الموافقة', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="لوحة تحكم المنصة"
        subtitle="نظرة عامة على الأداء والاهتمامات العاجلة"
        actions={
          <Link href="/platform/merchants">
            <Button variant="outline" icon="add">إضافة تاجر</Button>
          </Link>
        }
      />

      <div className="stats-grid">
        <StatsCard title="إجمالي التجار" value={stores.length} icon="storefront" tone="primary" />
        <StatsCard title="المتاجر النشطة" value={activeStores} icon="store" tone="green" changeLabel={`${suspendedStores} موقوف`} />
        <StatsCard title="الاشتراكات النشطة" value={activeSubs} icon="card_membership" tone="blue" changeLabel={`${pendingSubs} بانتظار`} />
        <StatsCard title="قريب من الحد" value={nearCount} icon="signal_cellular_alt_1_bar" tone="amber" />
        <StatsCard title="استنفد الحد" value={reachedCount} icon="block" tone="red" />
      </div>

      <Card title="يحتاج اهتماماً" subtitle={attention.length ? `${attention.length} متجر يتطلب إجراء` : 'كل المتاجر بحالة جيدة'} className="mb-2">
        {!overviewLoading && attention.length === 0 ? (
          <EmptyState icon="verified" title="لا توجد اهتمامات" description="جميع الاشتراكات نشطة والحدود ضمن المعدل الطبيعي." />
        ) : (
          attention.slice(0, 8).map((r) => {
            const reason = attentionReason(r)
            return (
              <div key={r.storeId} className="flex-between mb-1">
                <div className="flex flex-gap-sm">
                  <Badge tone={reason.tone}>{reason.label}</Badge>
                  <Link href={`/platform/stores/${r.storeId}`} className="font-semibold">{r.storeName}</Link>
                  <span className="muted small">
                    {r.planName || 'بدون خطة'}
                    {r.orderLimit > 0 ? ` — ${r.ordersUsed}/${r.orderLimit} (${r.usagePercent}%)` : ''}
                  </span>
                </div>
                <div className="flex flex-gap-sm">
                  {r.subStatus === 'pending' && r.subId && (
                    <Button size="sm" icon="check" onClick={() => approve(r)}>موافقة</Button>
                  )}
                  <Link href={`/platform/stores/${r.storeId}`}>
                    <Button variant="ghost" size="sm" icon="arrow_forward">عرض</Button>
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </Card>

      <div className="grid grid-2 mb-2">
        <Card title="نمو التجار (آخر 6 أشهر)" subtitle="عدد المتاجر الجديدة المسجلة شهرياً">
          {merchantGrowthSeries.every((v) => v === 0) ? (
            <EmptyState title="لا يوجد نمو" description="ستظهر المتاجر الجديدة هنا" />
          ) : (
            <BarChart values={merchantGrowthSeries} color="var(--violet)" height={180} />
          )}
        </Card>
        <Card title="توزيع الاشتراكات" subtitle="حالة اشتراكات جميع المتاجر">
          {subDonut.length === 0 ? (
            <EmptyState title="لا توجد اشتراكات" description="لم يتم إنشاء أي اشتراكات بعد" />
          ) : (
            <DonutChart data={subDonut} size={140} />
          )}
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="آخر التجار" subtitle={`${latestStores.length} من أصل ${stores.length}`}>
          {latestStores.length === 0 ? (
            <EmptyState title="لا توجد تجار" description="لم يتم إنشاء أي تجار بعد" />
          ) : (
            <Table cardMode
              columns={[
                { key: 'name', header: 'اسم التاجر', render: (s: Store) => <Link href={`/platform/stores/${s.id}`}>{s.name}</Link> },
                { key: 'active', header: 'الحالة', render: (s: Store) => <Badge tone={s.active ? 'green' : 'slate'}>{s.active ? 'نشط' : 'موقوف'}</Badge> },
                { key: 'createdAt', header: 'التاريخ', render: (s: Store) => <span className="muted">{timeAgo(s.createdAt)}</span> },
              ]}
              rows={latestStores}
            />
          )}
        </Card>
        <Card title="آخر الاشتراكات" subtitle={`${latestSubs.length} من أصل ${subs.length}`}>
          {latestSubs.length === 0 ? (
            <EmptyState title="لا توجد اشتراكات" description="لم يتم إنشاء أي اشتراكات بعد" />
          ) : (
            <Table cardMode
              columns={[
                { key: 'storeId', header: 'التاجر', render: (s: Subscription) => stores.find((st) => st.id === s.storeId)?.name || '—' },
                { key: 'planId', header: 'الباقة', render: (s: Subscription) => plans.find((p) => p.id === s.planId)?.name || '—' },
                { key: 'status', header: 'الحالة', render: (s: Subscription) => <Badge tone={SUBSCRIPTION_STATUS_TONES[s.status] || 'slate'}>{SUBSCRIPTION_STATUS_LABELS[s.status] || s.status}</Badge> },
                { key: 'createdAt', header: 'التاريخ', render: (s: Subscription) => <span className="muted">{timeAgo(s.createdAt)}</span> },
              ]}
              rows={latestSubs}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
export default PlatformDashboard
