import { FunctionalComponent } from 'preact'
import { formatNumber } from '../../utils/format'
import { ORDER_USAGE_LABELS, ORDER_USAGE_TONES } from '../../utils/constants'
import { usageFrom } from '../../services/subscription'
import type { Subscription, SubscriptionPlan } from '../../types'
import { Badge } from '../ui/Badge'
import { Progress } from '../ui/Progress'

interface Props {
  subscription?: Subscription | null
  plan?: SubscriptionPlan | null
  title?: string
  compact?: boolean
}

/**
 * Reusable order-usage panel: used / limit / remaining / percentage + bar.
 * Limits always come from the selected plan — never hardcoded.
 */
export const UsageCard: FunctionalComponent<Props> = ({ subscription, plan, title = 'استهلاك الطلبات', compact }) => {
  const usage = usageFrom(subscription, plan)
  const { used, limit, remaining, percent, level } = usage

  if (limit <= 0) {
    return (
      <div className="card">
        <div className="card-head"><h3 className="card-title">{title}</h3></div>
        <div className="card-body">
          <p className="font-semibold">حد الطلبات غير محدد</p>
          <p className="muted small">باقتك الحالية لا تفرض حداً على عدد الطلبات الشهرية.</p>
        </div>
      </div>
    )
  }

  const tone = level === 'reached' ? 'red' : level === 'near' || level === 'approaching' ? 'amber' : level === 'moderate' ? 'primary' : 'green'

  if (compact) {
    return (
      <div>
        <div className="flex-between small mb-1">
          <span className="font-semibold">{formatNumber(used)} / {formatNumber(limit)} طلب</span>
          <Badge tone={ORDER_USAGE_TONES[level]}>{ORDER_USAGE_LABELS[level]}</Badge>
        </div>
        <Progress value={used} max={limit} tone={tone} />
        <div className="muted small mt-1">
          {level === 'reached'
            ? 'استنفدت حد الطلبات لهذه الدورة.'
            : `لديك ${formatNumber(remaining ?? 0)} طلب متبقي من أصل ${formatNumber(limit)} (${percent}%).`}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-head"><h3 className="card-title">{title}</h3></div>
      <div className="card-body">
        <div className="flex-between mb-1">
          <span className="font-semibold">{formatNumber(used)} من {formatNumber(limit)} طلب</span>
          <Badge tone={ORDER_USAGE_TONES[level]}>{ORDER_USAGE_LABELS[level]}</Badge>
        </div>
        <Progress value={used} max={limit} tone={tone} />
        <div className="summary-row">
          <span>نسبة الاستخدام</span>
          <strong>{percent}%</strong>
        </div>
        <div className="summary-row">
          <span>الطلبات المتبقية</span>
          <strong>{formatNumber(remaining ?? 0)}</strong>
        </div>
        <p className="muted small mt-2">
          {level === 'reached'
            ? 'لقد استنفدت حد الطلبات لهذه الدورة. فعّل باقتك أو تواصل مع مدير المنصة.'
            : `لديك ${formatNumber(remaining ?? 0)} طلب متبقي من أصل ${formatNumber(limit)} في هذه الدورة.`}
        </p>
      </div>
    </div>
  )
}
