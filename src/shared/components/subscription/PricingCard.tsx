import { FunctionalComponent } from 'preact'
import { formatCurrency, formatPriceEgp } from '../../utils/format'
import { planEntitlements, canUseFeature, PLAN_FEATURE_KEYS, PLAN_FEATURE_LABELS, type PlanFeatureKey, isPlanLimitUnlimited } from '../../services/subscription'
import type { SubscriptionPlan } from '../../types'
import { Icon } from '../ui/Icon'

interface Props {
  plan: SubscriptionPlan
  selected?: boolean
  featured?: boolean
  yearly?: boolean
  onSelect?: () => void
  ctaLabel?: string
  displayName?: string
}

const LIMIT_ICONS: Record<string, string> = {
  products: 'inventory_2',
  orders: 'receipt_long',
  landingPages: 'web',
  salesLinks: 'link',
  staff: 'group_add',
  storage: 'database',
}

function storageLabel(mb: number): string {
  if (mb >= 1024) {
    const gb = mb / 1024
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB تخزين`
  }
  return `${mb} MB تخزين`
}

/**
 * Professional Arabic RTL pricing card (reused by the public pricing page,
 * the registration wizard and the merchant activation panel).
 * Prices/trial/limits/feature-flags come from the plan document — never
 * hardcoded. The Free plan is a one-time 30-day onboarding window; it is not
 * represented as a recurring free-forever subscription.
 */
export const PricingCard: FunctionalComponent<Props> = ({ plan, selected, featured, yearly, onSelect, ctaLabel, displayName }) => {
  const isFree = Number(plan.priceMonthly || 0) <= 0
  const isOneTime = plan.billingModel === 'one_time'
  const hasLaunch = !isFree && !isOneTime && !!plan.launchEnabled && Number(plan.launchPrice) > 0
  const trialDays = Number(plan.trialDays || 0)
  const limits = planEntitlements(plan)
  const isProductsUnlimited = isPlanLimitUnlimited('products', plan)
  const isSalesLinksUnlimited = isPlanLimitUnlimited('salesLinks', plan)
  const limitRows = (['products', 'orders', 'landingPages', 'salesLinks', 'staff', 'storage'] as const)
    .filter((k) => limits[k] > 0 || (k === 'products' && isProductsUnlimited) || (k === 'salesLinks' && isSalesLinksUnlimited))
    .map((k) => {
      if (k === 'products' && isProductsUnlimited) return { icon: LIMIT_ICONS[k], label: 'منتجات غير محدودة' }
      if (k === 'salesLinks' && isSalesLinksUnlimited) return { icon: LIMIT_ICONS[k], label: 'روابط بيع غير محدودة' }
      return {
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
                  : k === 'staff'
                    ? `حتى ${limits.staff} عضو فريق`
                    : limits.storage > 0
                      ? storageLabel(limits.storage)
                      : 'تخزين غير محدود',
      }
    })
  const featureFlags = PLAN_FEATURE_KEYS.filter((k) => canUseFeature(k, plan))
  const primaryFeatureFlags = featureFlags.slice(0, 4)
  const explicitFeatures = (plan.features || [])
    .filter((f) => !featureFlags.some((k) => PLAN_FEATURE_LABELS[k] === f))
    .filter((f) => !(isProductsUnlimited && f === 'منتجات غير محدودة'))
    .filter((f) => !(isSalesLinksUnlimited && f === 'روابط بيع غير محدودة'))
    .slice(0, 3)
  const price = isOneTime ? Number(plan.oneTimePrice || 0) : yearly && Number(plan.priceYearly || 0) > 0 ? plan.priceYearly : plan.priceMonthly

  return (
    <div className={`mk-pricing-card${selected ? ' mk-pricing-card--selected' : ''}${featured ? ' mk-pricing-card--featured' : ''}`}>
      {featured && <span className="mk-pricing-badge">الأكثر طلبًا</span>}
      <h3 className="mk-pricing-name">{displayName || plan.name}</h3>
      {plan.description && <p className="mk-pricing-desc">{plan.description}</p>}

      <div className="mk-pricing-price">
        {isFree && !isOneTime ? <strong>مجاناً</strong> : <strong>{formatPriceEgp(price)}</strong>}
        <span>{isOneTime ? 'دفعة واحدة' : isFree ? `لمدة ${trialDays || 30} يومًا` : yearly ? '/ سنوياً' : '/ شهريًا'}</span>
      </div>

      {hasLaunch && (
        <div className="mk-pricing-launch">
          <span className="mk-pricing-launch-label">أول شهر بسعر الإطلاق</span>
          <span className="mk-pricing-launch-price">{formatCurrency(plan.launchPrice)}</span>
          <span className="mk-pricing-launch-old">{formatCurrency(plan.priceMonthly)}</span>
        </div>
      )}

      {isFree && !isOneTime && (
        <div className="mk-pricing-trial">
          <Icon name="schedule" />
          أول شهر فقط — بعدها اختر باقة مدفوعة
        </div>
      )}

      <ul className="mk-pricing-features">
        {limitRows.map((r) => (
          <li key={r.label}>
            <Icon name={r.icon} />
            {r.label}
          </li>
        ))}
        {primaryFeatureFlags.map((k: PlanFeatureKey) => (
          <li key={k}>
            <Icon name="check_circle" />
            {PLAN_FEATURE_LABELS[k]}
          </li>
        ))}
        {explicitFeatures.map((f, i) => (
          <li key={`f${i}`}>
            <Icon name="check_circle" />
            {f}
          </li>
        ))}
        {isFree && !limits.storage && (
          <li>
            <Icon name="check_circle" />
            يناسب التجربة والبدايات
          </li>
        )}
        {featureFlags.length + explicitFeatures.length > primaryFeatureFlags.length + explicitFeatures.length && (
          <li className="mk-pricing-more">
            <Icon name="add_circle" />
            مزايا إضافية تظهر داخل لوحة الاشتراك
          </li>
        )}
      </ul>

      {onSelect && (
        <button type="button" className={`btn ${selected ? 'btn-primary' : 'btn-outline'} btn-block mk-pricing-cta`} onClick={onSelect}>
          {ctaLabel || (selected ? 'تم الاختيار' : 'ابدأ تجربتك المجانية')}
        </button>
      )}
    </div>
  )
}
