import { FunctionalComponent } from 'preact'
import { Icon } from '../../shared/components/ui/Icon'
import { formatDate, timeAgo } from '../../shared/utils/format'
import { TIMELINE_TYPE_ICONS, TIMELINE_TYPE_LABELS, type TimelineEventType } from '../../shared/utils/crm'
import type { CustomerTimelineEvent } from '../../shared/types'
import './CrmTimeline.css'

interface Props {
  events: CustomerTimelineEvent[]
  loading?: boolean
}

export const CrmTimeline: FunctionalComponent<Props> = ({ events, loading }) => {
  if (loading) return <div className="crm-timeline-loading"><span className="spinner spinner-sm" /> جاري تحميل السجل...</div>
  if (!events || events.length === 0) return <p className="muted small" style={{ padding: 12 }}>لا يوجد نشاط بعد. سيظهر هنا سجل الطلبات والمتابعات والملاحظات.</p>
  return (
    <div className="crm-timeline">
      {events.map((ev) => {
        const icon = TIMELINE_TYPE_ICONS[ev.type as TimelineEventType] || 'circle'
        const label = TIMELINE_TYPE_LABELS[ev.type as TimelineEventType] || ev.type
        return (
          <div key={ev.id} className="crm-timeline-row">
            <div className="crm-timeline-dot">
              <Icon name={icon} ariaHidden />
            </div>
            <div className="crm-timeline-content">
              <div className="crm-timeline-head">
                <strong>{ev.title || label}</strong>
                <span className="crm-timeline-time" title={formatDate(ev.createdAt)}>{timeAgo(ev.createdAt)}</span>
              </div>
              {ev.body && <p className="crm-timeline-body">{ev.body}</p>}
              <div className="crm-timeline-meta">
                <span className="crm-timeline-type">{label}</span>
                {ev.orderNumber && <span className="crm-timeline-order">{ev.orderNumber}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
