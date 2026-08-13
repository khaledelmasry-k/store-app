import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { approveSubscriptionCallable, rejectSubscriptionCallable } from '../../shared/services/auth'
import { resolveSubscriptionStatus } from '../../shared/services/subscription'
import { formatDate, formatNumber, timeAgo } from '../../shared/utils/format'
import { SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_TONES } from '../../shared/utils/constants'
import type { Subscription } from '../../shared/types'

export const PlatformSubscriptions: FunctionalComponent = () => {
  const subsRes = useCollection<Subscription>('subscriptions', { orderBy: { field: 'createdAt' } })
  const subs = subsRes.data
  const storesRes = useCollection('stores', {})
  const stores = storesRes.data
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const resolved = subs.map((s) => ({ ...s, _status: resolveSubscriptionStatus(s) }))

  const handleApprove = async (subId: string) => {
    setApprovingId(subId)
    try {
      await approveSubscriptionCallable({ subscriptionId: subId })
      toast.push('تمت الموافقة على الاشتراك', 'حساب التاجر أصبح نشطاً الآن', 'success')
    } catch (err: any) {
      toast.push('فشلت الموافقة', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async (subId: string) => {
    setRejectingId(subId)
    try {
      await rejectSubscriptionCallable({ subscriptionId: subId })
      toast.push('تم رفض الاشتراك', 'تم إرسال إشعار للتاجر', 'success')
    } catch (err: any) {
      toast.push('فشل الرفض', err?.message || 'حدث خطأ غير متوقع', 'error')
    } finally {
      setRejectingId(null)
    }
  }

  const counts = {
    active: resolved.filter((s) => s._status === 'active').length,
    trialing: resolved.filter((s) => s._status === 'trialing').length,
    pending: resolved.filter((s) => s._status === 'pending').length,
    expired: resolved.filter((s) => s._status === 'expired').length,
    suspended: resolved.filter((s) => s._status === 'suspended').length,
    cancelled: resolved.filter((s) => s._status === 'cancelled').length,
  }

  const filtered = status ? resolved.filter((s) => s._status === status) : resolved

  const statusLabel = (st: string) => SUBSCRIPTION_STATUS_LABELS[st as keyof typeof SUBSCRIPTION_STATUS_LABELS] || st
  const statusTone = (st: string) => SUBSCRIPTION_STATUS_TONES[st as keyof typeof SUBSCRIPTION_STATUS_TONES] || 'slate'

  return (
    <div>
      <PageHeader title="الاشتراكات" subtitle={`${subs.length} اشتراك`} />
      <div className="stats-grid">
        <StatsCard title="نشط" value={counts.active} icon="check_circle" tone="green" />
        <StatsCard title="تجربة مجانية" value={counts.trialing} icon="hourglass_top" tone="blue" />
        <StatsCard title="بانتظار الموافقة" value={counts.pending} icon="hourglass" tone="amber" />
        <StatsCard title="منتهي" value={counts.expired} icon="schedule" tone="slate" />
      </div>
      <FilterBar
        segments={[
          { label: 'الكل', value: '' },
          { label: 'نشط', value: 'active' },
          { label: 'تجربة مجانية', value: 'trialing' },
          { label: 'قيد الانتظار', value: 'pending' },
          { label: 'منتهي', value: 'expired' },
          { label: 'معلق', value: 'suspended' },
          { label: 'ملغي', value: 'cancelled' },
        ]}
        activeSegment={status}
        onSegmentChange={setStatus}
      />
      <Card>
        <Table cardMode
          columns={[
            { key: 'storeId', header: 'المتجر', render: (s: Subscription & { _status: string }) => (stores.find((x: any) => x.id === s.storeId) as any)?.name || '—' },
            { key: 'planName', header: 'الباقة' },
            { key: 'status', header: 'الحالة', render: (s: Subscription & { _status: string }) => <Badge tone={statusTone(s._status)}>{statusLabel(s._status)}</Badge> },
            { key: 'ordersUsed', header: 'الطلبات', render: (s: Subscription & { _status: string }) => <span className="muted">{formatNumber(s.ordersUsed || 0)}</span> },
            { key: 'periodEnd', header: 'انتهاء الدورة/التجربة', render: (s: Subscription & { _status: string }) => <span className="muted">{formatDate(s.trialEndsAt || s.currentPeriodEnd || s.expiresAt)}</span> },
            { key: 'createdAt', header: 'التاريخ', render: (s: Subscription & { _status: string }) => <span className="muted">{timeAgo(s.createdAt)}</span> },
            {
              key: 'actions',
              header: 'الإجراءات',
              render: (s: Subscription & { _status: string }) => (
                <div className="flex flex-gap-sm">
                  <Link href={`/platform/subscriptions/${s.id}`}><Button size="sm" variant="ghost" icon="visibility">تفاصيل</Button></Link>
                  {s._status === 'pending' && (
                    <>
                      <Button size="sm" icon="check" loading={approvingId === s.id} onClick={() => handleApprove(s.id)}>تفعيل</Button>
                      <Button size="sm" variant="ghost" icon="close" loading={rejectingId === s.id} onClick={() => handleReject(s.id)}>رفض</Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
          rows={filtered}
        />
      </Card>
    </div>
  )
}
export default PlatformSubscriptions
