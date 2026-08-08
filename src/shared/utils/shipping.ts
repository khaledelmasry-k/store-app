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

export function calculateShipping(ctx: ShippingContext): ShippingQuote {
  const cfg = ctx.store?.shipping
  const empty: ShippingQuote = { fee: 0, method: '', freeDelivery: false, policy: cfg?.refusedPolicy || '' }

  if (!cfg?.enabled) return empty
  if (isFreeShipping(cfg.freeAbove, ctx.subtotal)) {
    return { fee: 0, method: 'توصيل مجاني', freeDelivery: true, policy: cfg.refusedPolicy || '' }
  }

  if (cfg.model === 'flat') {
    const provider = firstActiveProvider(cfg.providers)
    return {
      fee: provider?.fee ?? cfg.flatFee ?? 0,
      method: provider?.name || 'شحن',
      freeDelivery: false,
      policy: cfg.refusedPolicy || '',
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
      policy: cfg.refusedPolicy || '',
    }
  }

  if (isFreeShipping(zone.freeAbove, ctx.subtotal)) {
    return { fee: 0, method: `${zone.name} — توصيل مجاني`, freeDelivery: true, policy: cfg.refusedPolicy || '' }
  }

  return {
    fee: zone.fee || 0,
    method: zone.name || 'شحن',
    freeDelivery: false,
    policy: cfg.refusedPolicy || '',
  }
}

function firstActiveProvider(providers?: ShippingProvider[]): ShippingProvider | undefined {
  if (!providers || providers.length === 0) return undefined
  return providers.find((p) => p.active)
}
