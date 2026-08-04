import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { useCollection } from '../../shared/hooks/useCollection'
import { formatDateTime } from '../../shared/utils/format'
import type { Notification } from '../../shared/types'

export const PlatformNotifications: FunctionalComponent = () => {
  const notificationsRes = useCollection<Notification>('notifications', { orderBy: { field: 'createdAt' } });
  const notifications = notificationsRes.data

  return (
    <div>
      <PageHeader title="الإشعارات" subtitle={`${notifications.length} إشعار`} />
      <Card>
        <Table
          columns={[
            { key: 'type', header: 'النوع', render: (n: Notification) => <Badge tone={n.type === 'billing' ? 'amber' : n.type === 'ticket' ? 'violet' : 'blue'}>{n.type}</Badge> },
            { key: 'title', header: 'العنوان' },
            { key: 'body', header: 'الرسالة' },
            { key: 'read', header: 'الحالة', render: (n: Notification) => <Badge tone={n.read ? 'slate' : 'green'}>{n.read ? 'مقروء' : 'جديد'}</Badge> },
            { key: 'createdAt', header: 'التاريخ', render: (n: Notification) => <span className="muted">{formatDateTime(n.createdAt)}</span> },
          ]}
          rows={notifications.slice(0, 50)}
        />
      </Card>
    </div>
  )
}
export default PlatformNotifications
