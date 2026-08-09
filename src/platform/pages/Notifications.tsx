import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { useCollection } from '../../shared/hooks/useCollection'
import { NotificationsTable } from '../../shared/components/notification/NotificationsTable'
import type { Notification } from '../../shared/types'

export const PlatformNotifications: FunctionalComponent = () => {
  const notificationsRes = useCollection<Notification>('notifications', { orderBy: { field: 'createdAt' } })
  const notifications = notificationsRes.data
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div>
      <PageHeader title="الإشعارات" subtitle={`${notifications.length} إشعار • ${unreadCount} غير مقروء`} />
      <NotificationsTable
        notifications={notifications}
        loading={notificationsRes.loading}
        error={notificationsRes.error}
        unreadCount={unreadCount}
      />
    </div>
  )
}
export default PlatformNotifications