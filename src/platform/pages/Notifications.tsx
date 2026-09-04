import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { NotificationsTable } from '../../shared/components/notification/NotificationsTable'
import type { Notification } from '../../shared/types'
import { notificationsService } from '../../shared/services/system'

export const PlatformNotifications: FunctionalComponent = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('')
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    notificationsService.list().then((items) => {
      if (!cancelled) setNotifications(items)
    }).catch((error) => {
      if (!cancelled) setLoadError(error instanceof Error ? error : new Error('تعذر تحميل الإشعارات'))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])
  const unreadCount = notifications.filter((n) => !n.read).length
  const filtered = notifications.filter((n) => (!query || `${n.title} ${n.body || ''} ${n.type}`.toLowerCase().includes(query.toLowerCase())) && (!scope || (scope === 'unread' ? !n.read : n.read)))

  return (
    <div className="platform-operations platform-notifications-page">
      <PageHeader title="إشعارات المنصة" subtitle={`${notifications.length} إشعار • ${unreadCount} غير مقروء`} />
      <Card className="platform-notifications-controls"><FilterBar search={query} onSearch={setQuery} searchPlaceholder="بحث في العنوان والنوع..." segments={[{ label: 'الكل', value: '' }, { label: 'غير مقروء', value: 'unread' }, { label: 'مقروء', value: 'read' }]} activeSegment={scope} onSegmentChange={setScope} /></Card>
      <NotificationsTable
        notifications={filtered}
        loading={loading}
        error={loadError}
        unreadCount={unreadCount}
        onMarkRead={(id) => notificationsService.update(id, { read: true })}
      />
    </div>
  )
}
export default PlatformNotifications
