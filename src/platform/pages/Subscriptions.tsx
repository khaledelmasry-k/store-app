import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { approveSubscriptionCallable, rejectSubscriptionCallable } from '../../shared/services/auth'
import { formatDate, timeAgo } from '../../shared/utils/format'
import type { Subscription } from '../../shared/types'

const STATUS_TONES: Record<string, string> = {
  active: 'green',
  pending: 'amber',
  expired: 'slate',
  cancelled: 'red',
  rejected: 'red',
}

export const PlatformSubscriptions: FunctionalComponent = () => {
  const subsRes = useCollection<Subscription>('subscriptions', { orderBy: { field: 'createdAt' } })
  const subs = subsRes.data
  const storesRes = useCollection('stores', {})
  const stores = storesRes.data
  const toast = useToast()
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

  return (
    <div>
      <PageHeader title="الاشتراكات" subtitle={`${subs.length} اشتراك`} />
      <div className="stats-grid">
        <StatsCard title="نشط" value={counts.active} icon="check_circle" tone="green" />
        <StatsCard title="بانتظار الموافقة" value={counts.pending} icon="hourglass" tone="amber" />
        <StatsCard title="منتهي" value={counts.expired} icon="schedule" tone="slate" />
      </div>
      <Card>
        <Table
          columns={[
            { key: 'storeId', header: 'المتجر', render: (s: Subscription) => (stores.find((x: any) => x.id === s.storeId) as any)?.name || '—' },
            { key: 'planName', header: 'الباقة' },
            { key: 'status', header: 'الحالة', render: (s: Subscription) => <Badge tone={(STATUS_TONES[s.status] as any) || 'slate'}>{s.status}</Badge> },
            { key: 'startedAt', header: 'البداية', render: (s: Subscription) => <span className="muted">{formatDate(s.startedAt)}</span> },
            { key: 'expiresAt', header: 'الانتهاء', render: (s: Subscription) => <span className="muted">{formatDate(s.expiresAt)}</span> },
            { key: 'createdAt', header: 'التاريخ', render: (s: Subscription) => <span className="muted">{timeAgo(s.createdAt)}</span> },
            {
              key: 'actions',
              header: 'الإجراءات',
              render: (s: Subscription) =>
                s.status === 'pending' ? (
                  <div className="flex" style={{ gap: 6 }}>
                    <Button
                      size="sm"
                      loading={approvingId === s.id}
                      onClick={() => handleApprove(s.id)}
                    >
                      تفعيل
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={rejectingId === s.id}
                      onClick={() => handleReject(s.id)}
                    >
                      رفض
                    </Button>
                  </div>
                ) : (
                  <span className="muted small">مكتمل</span>
                ),
            },
          ]}
          rows={subs}
        />
      </Card>
    </div>
  )
}
export default PlatformSubscriptions
