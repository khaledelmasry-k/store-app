import { FunctionalComponent } from 'preact'
import { Card } from '../ui/Card'
import { Table } from '../ui/Table'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Loading } from '../ui/Loading'
import { useToast } from '../../hooks/useToast'
import { notificationsService } from '../../services/system'
import { formatDateTime } from '../../utils/format'
import { NOTIFICATION_TONES } from '../../utils/constants'
import type { Notification } from '../../types'

interface Props {
  notifications: Notification[]
  loading?: boolean
  error?: Error | null
  /** Support marking a notification read by clicking the row. */
  onMarkRead?: (id: string) => void
  onMarkAllRead?: () => void
  unreadCount?: number
}

/**
 * Single source of truth for the notifications table. Used by both the
 * merchant and platform dashboards so read state, rendering, and actions are
 * never duplicated. Clicking an unread row marks it read.
 */
export const NotificationsTable: FunctionalComponent<Props> = ({
  notifications,
  loading,
  error,
  onMarkRead,
  onMarkAllRead,
  unreadCount = 0,
}) => {
  const toast = useToast()

  const markRead = async (id: string) => {
    if (onMarkRead) return onMarkRead(id)
    try {
      await notificationsService.update(id, { read: true })
      toast.push('تم تحديد الإشعار كمقروء')
    } catch (err: any) {
      toast.push('تعذر التحديث', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const markAllRead = async () => {
    if (onMarkAllRead) return onMarkAllRead()
    const unread = notifications.filter((n) => !n.read)
    for (const n of unread) {
      await notificationsService.update(n.id, { read: true }).catch(() => {})
    }
    toast.push('تم تحديد جميع الإشعارات كمقروءة')
  }

  if (loading) return <Loading />
  if (error) {
    return (
      <Card>
        <EmptyState icon="error" title="تعذر تحميل الإشعارات" description={error.message || 'حدث خطأ أثناء جلب البيانات.'} />
      </Card>
    )
  }
  if (notifications.length === 0) {
    return (
      <Card>
        <EmptyState icon="notifications" title="لا توجد إشعارات" description="ستظهر الإشعارات الجديدة هنا." />
      </Card>
    )
  }

  return (
    <Card>
      {unreadCount > 0 && (
        <div className="flex flex-end mb-1">
          <Button variant="outline" size="sm" icon="done_all" onClick={markAllRead}>
            تحديد الكل كمقروء
          </Button>
        </div>
      )}
      <Table cardMode
        onRowClick={(n: Notification) => {
          if (!n.read) markRead(n.id)
        }}
        columns={[
          { key: 'title', header: 'العنوان', render: (n: Notification) => <span className={n.read ? 'muted' : 'font-semibold'}>{n.title}</span> },
          { key: 'type', header: 'النوع', render: (n: Notification) => <Badge tone={(NOTIFICATION_TONES[n.type] as any) || 'slate'}>{n.type}</Badge> },
          { key: 'read', header: 'الحالة', render: (n: Notification) => <Badge tone={n.read ? 'green' : 'amber'}>{n.read ? 'مقروء' : 'جديد'}</Badge> },
          { key: 'createdAt', header: 'التاريخ', render: (n: Notification) => <span className="muted">{formatDateTime(n.createdAt)}</span> },
        ]}
        rows={notifications}
      />
    </Card>
  )
}