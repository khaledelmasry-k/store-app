import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { Icon } from '../../shared/components/ui/Icon'

interface Props {
  /** What limit was hit, e.g. "المنتجات", "الطلبات", "التخزين". */
  label: string
  /** Extra, more specific Arabic sentence (optional). */
  detail?: string
  /** Force a compact inline variant (no card padding) for in-form use. */
  compact?: boolean
}

/**
 * Plan-limit raiser. Shown wherever a merchant hits a plan ceiling
 * (product count, order count, storage quota…). It explains the block in
 * Arabic and routes them to the upgrade/billing page with a clear CTA.
 */
export const LimitRaiser: FunctionalComponent<Props> = ({ label, detail, compact }) => {
  return (
    <div className={compact ? 'limit-raiser limit-raiser--compact' : 'limit-raiser'}>
      <div className="limit-raiser-icon">
        <Icon name="rocket_launch" />
      </div>
      <div className="limit-raiser-body">
        <strong>وصلت إلى حد {label} في باقتك الحالية</strong>
        <p className="muted small">
          {detail || `ارفع باقتك لفك الحد والاستمرار في النمو.`}
        </p>
        <Link href="/subscription" className="btn btn-primary btn-sm limit-raiser-cta">
          <Icon name="arrow_upward" />
          ارفع باقتك الآن
        </Link>
      </div>
    </div>
  )
}
