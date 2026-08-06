import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatDateTime } from '../../shared/utils/format'
import { NOTIFICATION_TONES } from '../../shared/utils/constants'
import type { Notification } from '../../shared/types'

export const MerchantNotifications: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const notificationsRes = useCollection<Notification>('notifications', { storeId, orderBy: { field: 'createdAt' } })
  const notifications = notificationsRes.data
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div>
      <PageHeader title="الإشعارات" subtitle={`${notifications.length} إشعار • ${unreadCount} غير مقروء`} />

      <div className="stats-grid">
        <StatsCard title="إجمالي الإشعارات" value={notifications.length} icon="notifications" tone="primary" />
        <StatsCard title="غير مقروء" value={unreadCount} icon="mark_email_unread" tone="amber" />
      </div>

      <Card>
        <Table cardMode
          columns={[
            { key: 'title', header: 'العنوان' },
            { key: 'type', header: 'النوع', render: (n: Notification) => <Badge tone={(NOTIFICATION_TONES[n.type] as any) || 'slate'}>{n.type}</Badge> },
            { key: 'read', header: 'الحالة', render: (n: Notification) => <Badge tone={n.read ? 'green' : 'amber'}>{n.read ? 'مقروء' : 'جديد'}</Badge> },
            { key: 'createdAt', header: 'التاريخ', render: (n: Notification) => <span className="muted">{formatDateTime(n.createdAt)}</span> },
          ]}
          rows={notifications}
        />
      </Card>
    </div>
  )
}
export default MerchantNotifications