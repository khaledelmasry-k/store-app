import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { NotificationsTable } from '../../shared/components/notification/NotificationsTable'
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

      <NotificationsTable
        notifications={notifications}
        loading={notificationsRes.loading}
        error={notificationsRes.error}
        unreadCount={unreadCount}
      />
    </div>
  )
}
export default MerchantNotifications