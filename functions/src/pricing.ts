/**
 * Server-side quantity-pricing engine.
 *
 * This is the server half of a deliberately duplicated engine: Cloud Functions
 * is a separate npm package and cannot import from `src/`, so the same rules
 * live in `src/shared/utils/pricing.ts` for the cart and here for the order.
 * The two halves MUST agree — when they drift, the cart quotes one price and
 * the order charges another. `scripts/verify-pricing-parity.mjs` runs both
 * through the same case matrix and fails the build on any divergence; run it
 * after touching either file.
 *
 * Never accept a client-supplied price — everything here is recomputed from
 * the stored product.
 *
 * Model: a tier is a BUNDLE of exactly `quantity` pieces priced at a TOTAL
 * `price`. The line total is the tier's total price — it is NEVER multiplied
 * by the quantity again. Legacy tiers with `minQuantity`/`maxQuantity` keep
 * their old unit-price semantics and are detected automatically.
 */

/** True when a tier uses the bundle shape (`quantity`) rather than a legacy range. */
export function isBundleTier(t: any): boolean {
  return typeof t?.quantity === 'number' && Number.isFinite(t.quantity)
}

/** Per-unit base price for remainder units: the qty:1 tier, else `fallback`. */
export function baseUnitPrice(tiers: any[] | null | undefined, fallback: number): number {
  const t1 = (tiers || []).find((t: any) => isBundleTier(t) && t.quantity === 1)
  if (t1 && typeof t1.price === 'number') return t1.price
  return fallback || 0
}

/**
 * Total price for `qty` pieces under quantity (bundle) pricing.
 * For quantities beyond the highest configured tier, `strategy` (default
 * 'cap') decides the overflow behavior:
 *   - 'cap'    : highest bundle total + remainder at base unit price.
 *   - 'repeat' : repeat the highest bundle, remainder at base unit price.
 *   - 'last'   : always the highest bundle total once.
 * Returns null when there are no bundle tiers (caller falls back to standard).
 */
export function quantityTotalPrice(
  tiers: any[] | null | undefined,
  qty: number,
  strategy: string = 'cap',
  fallbackBase = 0,
): number | null {
  const sorted = [...(tiers || [])]
    .filter((t: any) => isBundleTier(t))
    .sort((a: any, b: any) => Number(a.quantity) - Number(b.quantity))
  if (sorted.length === 0 || qty < 1) return null
  const base = baseUnitPrice(tiers, fallbackBase)
  const highest = sorted[sorted.length - 1]
  const exact = sorted.find((t: any) => t.quantity === qty)
  const largestBelow = [...sorted].reverse().find((t: any) => t.quantity < qty) || null

  if (strategy === 'last') {
    if (exact) return exact.price
    if (qty >= Number(highest.quantity)) return highest.price
    if (largestBelow) return largestBelow.price + (qty - Number(largestBelow.quantity)) * base
    return qty * base
  }
  if (strategy === 'repeat') {
    let remaining = qty
    let total = 0
    while (remaining > 0) {
      const t = [...sorted].reverse().find((x: any) => x.quantity <= remaining) || null
      if (t) {
        total += t.price
        remaining -= t.quantity
      } else {
        total += base * remaining
        remaining = 0
      }
    }
    return total
  }
  // 'cap' (default)
  if (exact) return exact.price
  if (qty > Number(highest.quantity)) return highest.price + (qty - Number(highest.quantity)) * base
  if (largestBelow) return largestBelow.price + (qty - Number(largestBelow.quantity)) * base
  return qty * base
}

/**
 * Total price for a quantity under bundle pricing, else null.
 *
 * Must stay equivalent to `lineSubtotal` in `src/shared/utils/pricing.ts`,
 * which is the number the cart shows the customer:
 *   - it does NOT require every tier to be a bundle (`quantityTotalPrice`
 *     already filters). Requiring it made mixed legacy+bundle tier arrays fall
 *     through to `unitPriceForQty`, which returns a TOTAL that the caller then
 *     multiplied by the quantity again — charging qty× the cart price.
 *   - `fallbackBase` must be the product/variant price, not 0. With 0 the
 *     remainder units above the highest tier were priced at zero whenever the
 *     product had no qty:1 tier, so the order undercharged the cart.
 */
export function tierTotalForQuantity(
  tiers: any[] | null | undefined,
  qty: number,
  strategy: string = 'cap',
  fallbackBase = 0,
): number | null {
  return quantityTotalPrice(tiers, qty, strategy, fallbackBase)
}

/** Effective unit price for a quantity; standard pricing returns `basePrice`. */
export function unitPriceForQty(
  basePrice: number,
  qty: number,
  pricingMode?: string | null,
  tiers?: any[] | null,
  strategy: string = 'cap',
): number {
  if (pricingMode === 'quantity') {
    const total = quantityTotalPrice(tiers, qty, strategy, basePrice)
    if (total != null) return total
  }
  return basePrice || 0
}

/**
 * Line total for one order item — the single entry point `createOrder` uses.
 * Mirrors `lineSubtotal` in the client engine exactly.
 */
export function lineTotalForItem(
  basePrice: number,
  qty: number,
  pricingMode?: string | null,
  tiers?: any[] | null,
  strategy: string = 'cap',
): { unit: number; lineTotal: number; bundleTotal: number | null } {
  if (pricingMode === 'quantity') {
    const bundleTotal = tierTotalForQuantity(tiers, qty, strategy, basePrice)
    if (bundleTotal != null) return { unit: bundleTotal / qty, lineTotal: bundleTotal, bundleTotal }
  }
  const unit = unitPriceForQty(basePrice, qty, pricingMode, tiers, strategy)
  return { unit, lineTotal: unit * qty, bundleTotal: null }
}
