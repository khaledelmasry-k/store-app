import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatDateTime } from '../../shared/utils/format'
import { NOTIFICATION_TONES } from '../../shared/utils/constants'
import type { Notification } from '../../shared/types'

export const PlatformNotifications: FunctionalComponent = () => {
  const notificationsRes = useCollection<Notification>('notifications', { orderBy: { field: 'createdAt' } })
  const notifications = notificationsRes.data

  return (
    <div>
      <PageHeader title="الإشعارات" subtitle={`${notifications.length} إشعار`} />
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
export default PlatformNotifications