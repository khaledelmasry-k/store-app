import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Button } from '../../shared/components/ui/Button'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Loading } from '../../shared/components/ui/Loading'
import { Icon } from '../../shared/components/ui/Icon'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { notificationsService } from '../../shared/services/system'
import { timeAgo } from '../../shared/utils/format'
import type { Notification } from '../../shared/types'
import './Notifications.css'

const TYPE_CHIPS: Record<string, { label: string; tone: 'secondary' | 'tertiary' }> = {
  order: { label: 'الطلبات', tone: 'secondary' },
  system: { label: 'النظام', tone: 'tertiary' },
  billing: { label: 'الفوترة', tone: 'tertiary' },
  ticket: { label: 'الدعم', tone: 'tertiary' },
}

type Filter = 'all' | 'unread' | 'read'

export const MerchantNotifications: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const notificationsRes = useCollection<Notification>('notifications', { storeId, orderBy: { field: 'createdAt' } })
  const notifications = notificationsRes.data
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [reloadKey, setReloadKey] = useState(0)

  const unreadCount = notifications.filter((n) => !n.read).length
  const visible = notifications.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !n.read : n.read))

  const markRead = async (id: string) => {
    try {
      await notificationsService.update(id, { read: true })
    } catch (err: any) {
      toast.push('تعذر التحديث', err?.message || 'حدث خطأ غير متوقع', 'error')
    }
  }

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read)
    for (const n of unread) {
      await notificationsService.update(n.id, { read: true }).catch(() => {})
    }
    toast.push('تم تحديد جميع الإشعارات كمقروءة')
  }

  return (
    <div className="merchant-operations merchant-notifications-page">
      <PageHeader
        title="الإشعارات"
        subtitle={`${notifications.length} إشعار • ${unreadCount} غير مقروء`}
        actions={
          <div className="notif-header-actions">
            <Button variant="outline" icon="done_all" onClick={markAllRead} disabled={!unreadCount}>تحديد الكل كمقروء</Button>
            <Button icon="refresh" onClick={() => setReloadKey(reloadKey + 1)}>تحديث</Button>
          </div>
        }
      />

      <div className="notif-tabs">
        <button type="button" className={`notif-tab${filter === 'all' ? ' is-active' : ''}`} onClick={() => setFilter('all')}>الكل</button>
        <button type="button" className={`notif-tab${filter === 'unread' ? ' is-active' : ''}`} onClick={() => setFilter('unread')}>
          غير مقروء
          {unreadCount > 0 && <span className="notif-tab-badge">{unreadCount}</span>}
        </button>
        <button type="button" className={`notif-tab${filter === 'read' ? ' is-active' : ''}`} onClick={() => setFilter('read')}>مقروءة</button>
      </div>

      <div className="notif-feed" key={reloadKey}>
        {notificationsRes.loading ? (
          <Loading />
        ) : notificationsRes.error ? (
          <div className="notif-empty">
            <EmptyState icon="error" title="تعذر تحميل الإشعارات" description={notificationsRes.error.message || 'حدث خطأ أثناء جلب البيانات.'} />
          </div>
        ) : visible.length === 0 ? (
          <div className="notif-empty">
            <EmptyState icon="notifications" title={filter === 'all' ? 'لا توجد إشعارات' : filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات مقروءة'} description="ستظهر الإشعارات الجديدة هنا." />
          </div>
        ) : (
          visible.map((n) => {
            const chip = TYPE_CHIPS[n.type] || { label: n.type, tone: 'tertiary' as const }
            return (
              <div
                key={n.id}
                className={`notif-item${n.read ? '' : ' is-unread'}`}
                onClick={() => { if (!n.read) markRead(n.id) }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' && !n.read) markRead(n.id) }}
              >
                <span className="notif-dot" aria-hidden />
                <div className="notif-body">
                  <div className="notif-top">
                    <div className="notif-top-side">
                      <span className={`notif-chip is-${chip.tone}`}>{chip.label}</span>
                      <span className="notif-title">{n.title}</span>
                    </div>
                    <span className="notif-time">{timeAgo(n.createdAt)}</span>
                  </div>
                  {n.body && <p className="notif-text">{n.body}</p>}
                </div>
                {!n.read && (
                  <button
                    type="button"
                    className="notif-read-btn"
                    title="تحديد كمقروء"
                    aria-label="تحديد كمقروء"
                    onClick={(e) => { e.stopPropagation(); markRead(n.id) }}
                  >
                    <Icon name="check_circle" ariaHidden />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
export default MerchantNotifications