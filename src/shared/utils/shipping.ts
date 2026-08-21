import type { ShippingProvider, ShippingZone, Store } from '../types'

/**
 * Shared shipping engine.
 *
 * Single source of truth for checkout shipping quotes. The server
 * (`functions/src/index.ts` `createOrder`) mirrors this logic — never accept a
 * client-supplied shipping fee.
 */

export interface ShippingQuote {
  /** Fee charged for this delivery (0 = free or shipping disabled). */
  fee: number
  /** Human-readable method name (zone name, provider name, or generic). */
  method: string
  /** True when the order qualifies for free shipping. */
  freeDelivery: boolean
  /** Policy text for refused deliveries (empty when not configured). */
  policy: string
  /** Whether the destination is covered by an actual configured rule. */
  available: boolean
  /** Human-readable reason when the destination is not covered. */
  unavailableReason?: string
}

export interface ShippingContext {
  store?: Pick<Store, 'shipping'> | null
  zones: ShippingZone[]
  subtotal: number
  governorate: string
}

/** Applies free-above threshold; returns true when shipping is free. */
function isFreeShipping(threshold: number | undefined | null, subtotal: number): boolean {
  return !!threshold && threshold > 0 && subtotal >= threshold
}

function showRefusedPolicy(cfg: { refusedPolicy?: string; refusedPolicyEnabled?: boolean }): string {
  return cfg?.refusedPolicyEnabled !== false ? cfg?.refusedPolicy || '' : ''
}

/** Prefers the store default provider, then falls back to the first active one. */
function effectiveProvider(cfg: { providers?: ShippingProvider[]; defaultProviderId?: string }): ShippingProvider | undefined {
  const providers = cfg?.providers || []
  if (cfg?.defaultProviderId) {
    const chosen = providers.find((p) => p.id === cfg.defaultProviderId)
    if (chosen && chosen.active) return chosen
  }
  return providers.find((p) => p.active)
}

export function calculateShipping(ctx: ShippingContext): ShippingQuote {
  const cfg = ctx.store?.shipping
  const policy = showRefusedPolicy(cfg || {})
  const empty: ShippingQuote = { fee: 0, method: '', freeDelivery: false, policy, available: true }

  // Disabled shipping is an intentional merchant policy (for example local
  // pickup), so it remains a valid zero-fee checkout. An enabled policy must
  // still prove destination coverage below.
  if (!cfg?.enabled) return { ...empty, method: 'بدون شحن' }

  if (cfg.model === 'flat') {
    const provider = effectiveProvider(cfg)
    const hasRule = Boolean(provider || cfg.flatFee != null || cfg.freeAbove != null)
    if (!hasRule) {
      return { fee: 0, method: 'الشحن غير متوفر', freeDelivery: false, policy, available: false, unavailableReason: 'لا توجد قاعدة شحن مفعّلة' }
    }
    if (isFreeShipping(cfg.freeAbove, ctx.subtotal)) {
      return { fee: 0, method: 'توصيل مجاني', freeDelivery: true, policy, available: true }
    }
    return {
      fee: provider?.fee ?? cfg.flatFee ?? 0,
      method: provider?.name || 'شحن',
      freeDelivery: false,
      policy,
      available: true,
    }
  }

  // zones model — find the first active zone covering the chosen governorate.
  const zone = ctx.zones
    .filter((z) => z.active)
    .find((z) => (z.governorates || []).includes(ctx.governorate))

  if (!zone) {
    return {
      fee: 0,
      method: 'الشحن غير متوفر لهذه المنطقة',
      freeDelivery: false,
      policy,
      available: false,
      unavailableReason: 'لا توجد قاعدة شحن لهذه المحافظة',
    }
  }

  if (isFreeShipping(zone.freeAbove, ctx.subtotal)) {
    return { fee: 0, method: `${zone.name} — توصيل مجاني`, freeDelivery: true, policy, available: true }
  }

  return {
    fee: zone.fee || 0,
    method: zone.name || 'شحن',
    freeDelivery: false,
    policy,
    available: true,
  }
}
