import { FunctionalComponent } from 'preact'
import { formatCurrency } from '../../utils/format'
import { planEntitlements } from '../../services/subscription'
import type { SubscriptionPlan } from '../../types'
import { Icon } from '../ui/Icon'

interface Props {
  plan: SubscriptionPlan
  selected?: boolean
  featured?: boolean
  onSelect?: () => void
  ctaLabel?: string
}

const LIMIT_ICONS: Record<string, string> = {
  products: 'inventory_2',
  orders: 'receipt_long',
  landingPages: 'web',
  salesLinks: 'link',
  staff: 'group_add',
}

/**
 * Professional Arabic RTL pricing card (reused by the public landing page,
 * the registration wizard and the merchant activation panel).
 * Prices/trial/limits come from the plan document — never hardcoded.
 */
export const PricingCard: FunctionalComponent<Props> = ({ plan, selected, featured, onSelect, ctaLabel }) => {
  const hasLaunch = !!plan.launchEnabled && Number(plan.launchPrice) > 0
  const trialDays = Number(plan.trialDays || 3)
  const limits = planEntitlements(plan)
  const limitRows = (['products', 'orders', 'landingPages', 'salesLinks', 'staff'] as const)
    .filter((k) => limits[k] > 0)
    .map((k) => ({
      icon: LIMIT_ICONS[k],
      label:
        k === 'products'
          ? `حتى ${limits.products} منتج`
          : k === 'orders'
            ? `حتى ${limits.orders} طلب شهرياً`
            : k === 'landingPages'
              ? `حتى ${limits.landingPages} صفحة هبوط`
              : k === 'salesLinks'
                ? `حتى ${limits.salesLinks} رابط بيع`
                : `حتى ${limits.staff} عضو فريق`,
    }))

  return (
    <div className={`mk-pricing-card${selected ? ' mk-pricing-card--selected' : ''}${featured ? ' mk-pricing-card--featured' : ''}`}>
      {featured && <span className="mk-pricing-badge">الأكثر شيوعاً</span>}
      <h3 className="mk-pricing-name">{plan.name}</h3>
      {plan.description && <p className="mk-pricing-desc">{plan.description}</p>}

      <div className="mk-pricing-price">
        <strong>{formatCurrency(plan.priceMonthly)}</strong>
        <span>/ شهرياً</span>
      </div>

      {hasLaunch && (
        <div className="mk-pricing-launch">
          <span className="mk-pricing-launch-label">أول شهر بسعر الإطلاق</span>
          <span className="mk-pricing-launch-price">{formatCurrency(plan.launchPrice)}</span>
          <span className="mk-pricing-launch-old">{formatCurrency(plan.priceMonthly)}</span>
        </div>
      )}

      <div className="mk-pricing-trial">
        <Icon name="local_offer" />
        تجربة مجانية لمدة {trialDays} يوم — بكامل المزايا
      </div>

      <ul className="mk-pricing-features">
        {limitRows.map((r) => (
          <li key={r.label}>
            <Icon name={r.icon} />
            {r.label}
          </li>
        ))}
        {(plan.features || []).slice(0, 6).map((f, i) => (
          <li key={`f${i}`}>
            <Icon name="check_circle" />
            {f}
          </li>
        ))}
      </ul>

      {onSelect && (
        <button type="button" className={`btn ${selected ? 'btn-primary' : 'btn-outline'} btn-block mk-pricing-cta`} onClick={onSelect}>
          {ctaLabel || (selected ? 'تم الاختيار' : 'ابدأ تجربتك المجانية')}
        </button>
      )}
    </div>
  )
}
