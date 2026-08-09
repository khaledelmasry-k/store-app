import { FunctionalComponent } from 'preact'
import { STATUS_LABELS } from '../../utils/constants'
import { formatDateTime } from '../../utils/format'
import type { Order } from '../../types'
import { Icon } from '../ui/Icon'
import { Badge } from '../ui/Badge'

const PROGRESS: Order['status'][] = ['NEW', 'CONTACTED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
const TERMINAL: Order['status'][] = ['CANCELLED', 'RETURNED']

/**
 * Real order timeline driven by the backend's statusHistory. When history is
 * present every reached step shows its actual timestamp; otherwise the current
 * status alone drives the step markers. Never invents statuses — every label
 * comes from STATUS_LABELS.
 */
export const OrderTimeline: FunctionalComponent<{ order: Pick<Order, 'status' | 'statusHistory'> }> = ({ order }) => {
  const history = Array.isArray(order.statusHistory) ? order.statusHistory.filter((h) => h.status) : []
  const stepIndex = PROGRESS.indexOf(order.status)

  const timeFor = (s: Order['status']) => history.find((h) => h.status === s)?.at

  return (
    <div className="order-steps">
      {PROGRESS.map((s, i) => {
        const done = history.length > 0 ? history.some((h) => h.status === s) : (stepIndex >= 0 && i <= stepIndex)
        const active = !TERMINAL.includes(order.status) && i === stepIndex
        const at = timeFor(s)
        return (
          <div key={s} className={`order-step${done ? ' order-step--done' : ''}${active ? ' order-step--active' : ''}`}>
            <span className="order-step-dot">
              {done && !active ? <Icon name="check" /> : i + 1}
            </span>
            <span className="order-step-label">
              {STATUS_LABELS[s] || s}
              {at && <em className="order-step-time">{formatDateTime(at)}</em>}
            </span>
            {i < PROGRESS.length - 1 && <span className="order-step-line" />}
          </div>
        )
      })}
      {TERMINAL.includes(order.status) && (
        <div className="order-step-terminal">
          <Icon name="info" />
          <Badge tone="red">{STATUS_LABELS[order.status]}</Badge>
          <span className="muted small">هذا الطلب في حالة نهائية ولا يمكن متابعة تنفيذه.</span>
        </div>
      )}
    </div>
  )
}