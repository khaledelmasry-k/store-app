import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
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
import { formatDate, timeAgo } from '../../shared/utils/format'
import { SUBSCRIPTION_STATUS_TONES } from '../../shared/utils/constants'
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
    active: subs.filter((s) => s.status === 'active').length,
    pending: subs.filter((s) => s.status === 'pending').length,
    expired: subs.filter((s) => s.status === 'expired').length,
  }

  const filtered = status ? subs.filter((s) => s.status === status) : subs

  return (
    <div>
      <PageHeader title="الاشتراكات" subtitle={`${subs.length} اشتراك`} />
      <div className="stats-grid">
        <StatsCard title="نشط" value={counts.active} icon="check_circle" tone="green" />
        <StatsCard title="بانتظار الموافقة" value={counts.pending} icon="hourglass" tone="amber" />
        <StatsCard title="منتهي" value={counts.expired} icon="schedule" tone="slate" />
      </div>
      <FilterBar
        segments={[
          { label: 'الكل', value: '' },
          { label: 'نشط', value: 'active' },
          { label: 'قيد الانتظار', value: 'pending' },
          { label: 'منتهي', value: 'expired' },
          { label: 'ملغي', value: 'cancelled' },
        ]}
        activeSegment={status}
        onSegmentChange={setStatus}
      />
      <Card>
        <Table cardMode
          columns={[
            { key: 'storeId', header: 'المتجر', render: (s: Subscription) => (stores.find((x: any) => x.id === s.storeId) as any)?.name || '—' },
            { key: 'planName', header: 'الباقة' },
            { key: 'status', header: 'الحالة', render: (s: Subscription) => <Badge tone={(SUBSCRIPTION_STATUS_TONES[s.status] as any) || 'slate'}>{s.status}</Badge> },
            { key: 'startedAt', header: 'البداية', render: (s: Subscription) => <span className="muted">{formatDate(s.startedAt)}</span> },
            { key: 'expiresAt', header: 'الانتهاء', render: (s: Subscription) => <span className="muted">{formatDate(s.expiresAt)}</span> },
            { key: 'createdAt', header: 'التاريخ', render: (s: Subscription) => <span className="muted">{timeAgo(s.createdAt)}</span> },
            {
              key: 'actions',
              header: 'الإجراءات',
              render: (s: Subscription) =>
                s.status === 'pending' ? (
                  <div className="flex flex-gap-sm">
                    <Button size="sm" icon="check" loading={approvingId === s.id} onClick={() => handleApprove(s.id)}>تفعيل</Button>
                    <Button size="sm" variant="ghost" icon="close" loading={rejectingId === s.id} onClick={() => handleReject(s.id)}>رفض</Button>
                  </div>
                ) : (
                  <span className="muted small">مكتمل</span>
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
