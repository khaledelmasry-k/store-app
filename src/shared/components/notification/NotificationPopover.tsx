import { FunctionalComponent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection'
import { notificationsService } from '../../services/system'
import { timeAgo } from '../../utils/format'
import { Icon } from '../ui/Icon'
import type { Notification } from '../../types'

export const NotificationPopover: FunctionalComponent<{ storeId?: string; href: string }> = ({ storeId, href }) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const res = useRealtimeCollection<Notification>('notifications', { storeId, orderBy: { field: 'createdAt' } }, Boolean(storeId))
  const notifications = res.data.slice(-20).reverse()
  const unread = notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onOutside = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutside)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onOutside) }
  }, [open])

  const markRead = async (n: Notification) => {
    if (!n.read) await notificationsService.update(n.id, { read: true }).catch(() => {})
    setOpen(false)
  }
  const markAll = async () => { await Promise.all(notifications.filter((n) => !n.read).map((n) => notificationsService.update(n.id, { read: true }).catch(() => {}))) }

  return <div className="notification-popover-root" ref={rootRef}>
    <button data-tour="notifications-bell" type="button" className="topbar-icon-btn notification-bell" aria-label="الإشعارات" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
      <Icon name="notifications" />{unread > 0 && <span className="notification-unread-badge">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div className="notification-popover" role="dialog" aria-label="الإشعارات">
      <header><strong>الإشعارات</strong><span>{unread} غير مقروءة</span></header>
      {unread > 0 && <button type="button" className="notification-mark-all" onClick={markAll}>تحديد الكل كمقروء</button>}
      <div className="notification-popover-list">
        {res.loading ? <div className="notification-popover-empty">جارٍ تحميل الإشعارات...</div> : notifications.length === 0 ? <div className="notification-popover-empty">لا توجد إشعارات جديدة</div> : notifications.map((n) => <button type="button" key={n.id} className={`notification-popover-item${n.read ? '' : ' is-unread'}`} onClick={() => markRead(n)}><span className="notification-popover-dot" /><span><strong>{n.title}</strong><small>{n.body}</small><em>{timeAgo(n.createdAt)}</em></span></button>)}
      </div>
      <Link href={href} className="notification-popover-footer" onClick={() => setOpen(false)}>عرض كل الإشعارات</Link>
    </div>}
  </div>
}
