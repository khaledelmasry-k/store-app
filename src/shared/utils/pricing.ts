import type { CartLine, Product, ProductVariant, QuantityPricingStrategy, QuantityTier } from '../types'

/**
 * Shared quantity-pricing engine.
 *
 * Single source of truth used by the product page, cart, checkout, and the
 * server (`functions/src/index.ts` mirrors this logic). Never duplicate tier
 * resolution in components.
 *
 * Model: a tier is a BUNDLE of exactly `quantity` pieces priced at a TOTAL
 * `price`. The line total is the tier's total price — it is NEVER multiplied
 * by the quantity again. Legacy tiers with `minQuantity`/`maxQuantity` keep
 * their old unit-price semantics and are detected automatically.
 */

/** True when a tier uses the new exact-bundle shape (`quantity` field). */
function isBundleTier(t: QuantityTier): boolean {
  return typeof t.quantity === 'number' && Number.isFinite(t.quantity)
}

/** Sorted copy of the tiers by ascending quantity. */
function sortedTiers(tiers: QuantityTier[] | undefined | null): QuantityTier[] {
  if (!tiers || tiers.length === 0) return []
  return [...tiers].sort((a, b) => (isBundleTier(a) ? a.quantity : a.minQuantity || 0) - (isBundleTier(b) ? b.quantity : b.minQuantity || 0))
}

/** The per-unit base price used for remainder units: the qty:1 tier, else `fallback`. */
function baseUnitPrice(tiers: QuantityTier[] | undefined | null, fallback: number): number {
  const t1 = (tiers || []).find((t) => isBundleTier(t) && t.quantity === 1)
  if (t1 && typeof t1.price === 'number') return t1.price
  return fallback || 0
}

/**
 * Total price for `qty` pieces under quantity (bundle) pricing.
 *
 * For a request larger than the highest configured tier, the behavior depends
 * on `strategy` (default 'cap' — the safest commercial option):
 *   - 'cap'    : highest bundle total + (qty - highestQty) × base unit price.
 *   - 'repeat' : repeat the highest bundle as many times as it fits, then the
 *                remainder at base unit price.
 *   - 'last'   : always the highest bundle total once (overflow ignored).
 *
 * Returns null when there are no bundle tiers (caller falls back to standard).
 */
export function quantityTotalPrice(
  tiers: QuantityTier[] | undefined | null,
  qty: number,
  strategy: QuantityPricingStrategy = 'cap',
  fallbackBase = 0,
): number | null {
  const sorted = sortedTiers(tiers).filter(isBundleTier)
  if (sorted.length === 0 || qty < 1) return null
  const base = baseUnitPrice(tiers, fallbackBase)
  const highest = sorted[sorted.length - 1]
  const exact = sorted.find((t) => t.quantity === qty)
  const largestBelow = [...sorted].reverse().find((t) => t.quantity < qty) || null

  if (strategy === 'last') {
    if (exact) return exact.price
    if (qty >= (highest.quantity || 0)) return highest.price
    if (largestBelow) return largestBelow.price + (qty - (largestBelow.quantity || 0)) * base
    return qty * base
  }

  if (strategy === 'repeat') {
    let remaining = qty
    let total = 0
    while (remaining > 0) {
      const t = [...sorted].reverse().find((x) => (x.quantity || 0) <= remaining) || null
      if (t) {
        total += t.price
        remaining -= t.quantity || 0
      } else {
        total += base * remaining
        remaining = 0
      }
    }
    return total
  }

  // 'cap' (default)
  if (exact) return exact.price
  if (qty > (highest.quantity || 0)) return (highest.price || 0) + (qty - (highest.quantity || 0)) * base
  if (largestBelow) return largestBelow.price + (qty - (largestBelow.quantity || 0)) * base
  return qty * base
}

/**
 * Returns the tier that applies for a given quantity, or null.
 * - bundle tiers: exact match on `quantity`.
 * - legacy range tiers: first range containing the qty (fall back to last).
 */
export function tierForQuantity(tiers: QuantityTier[] | undefined | null, qty: number): QuantityTier | null {
  const sorted = sortedTiers(tiers)
  if (sorted.length === 0 || qty < 1) return null
  for (const t of sorted) {
    if (isBundleTier(t)) {
      if (qty === t.quantity) return t
    } else if (qty >= (t.minQuantity || 0) && (t.maxQuantity == null || qty <= (t.maxQuantity as number))) {
      return t
    }
  }
  const last = sorted[sorted.length - 1]
  if (!isBundleTier(last) && last.maxQuantity != null && qty > (last.maxQuantity as number)) return last
  return null
}

/**
 * Total price for a quantity under quantity pricing.
 * - bundle tiers: the tier's TOTAL `price` (handles overflow via `strategy`).
 * - legacy tiers: unit price (callers multiply by qty for compat).
 * Returns null when no bundle tier applies.
 */
export function tierTotalForQuantity(
  tiers: QuantityTier[] | undefined | null,
  qty: number,
  strategy: QuantityPricingStrategy = 'cap',
): number | null {
  if (tiers && tiers.length > 0 && tiers.every(isBundleTier)) {
    return quantityTotalPrice(tiers, qty, strategy, 0)
  }
  return null
}

/**
 * Resolves the effective unit price for a quantity.
 *
 * - quantity pricing: the matching tier price (or falls back to `basePrice`).
 * - standard pricing: `basePrice`.
 */
export function unitPriceForQty(
  basePrice: number,
  qty: number,
  pricingMode?: string | null,
  tiers?: QuantityTier[] | null,
  strategy: QuantityPricingStrategy = 'cap',
): number {
  if (pricingMode === 'quantity') {
    const total = quantityTotalPrice(tiers, qty, strategy, basePrice)
    if (total != null) return total
  }
  return basePrice || 0
}

/**
 * Line total using the line's price snapshot + quantity pricing if present.
 *
 * Bundle tiers: returns the tier's TOTAL price (no multiplication), including
 * the overflow strategy when quantity exceeds the highest configured tier.
 * Standard pricing / legacy tiers: returns unit price × quantity.
 */
export function lineSubtotal(line: CartLine): number {
  const qty = Math.max(1, line.quantity || 1)
  if (line.pricingMode === 'quantity' && line.quantityTiers && line.quantityTiers.length > 0) {
    const strategy = line.quantityPricingStrategy || 'cap'
    const total = quantityTotalPrice(line.quantityTiers, qty, strategy, line.price)
    if (total != null) return total
    // Bundle tier snapshot lost — fall back to the computed total.
    const unit = unitPriceForQty(line.price, qty, line.pricingMode, line.quantityTiers, strategy)
    return unit * qty
  }
  // Standard pricing: always recompute unit × qty. The stored `lineTotal`
  // snapshot would go stale when the quantity changes in the cart (only
  // `quantity` is mutated), so it must never be trusted here.
  return (line.price || 0) * qty
}

/** Cart subtotal = sum of line subtotals (uses quantity pricing). */
export function cartSubtotal(items: CartLine[]): number {
  return items.reduce((s, i) => s + lineSubtotal(i), 0)
}

/**
 * Resolves the display price for a product page selection.
 * - quantity pricing with a bundle tier: returns the tier's TOTAL price.
 * - otherwise: the effective unit price (variant override → base).
 */
export function productUnitPrice(
  product: Pick<Product, 'price' | 'variants' | 'pricingMode' | 'quantityTiers' | 'quantityPricingStrategy'>,
  variant: ProductVariant | undefined,
  qty: number,
): number {
  if (product.pricingMode === 'quantity') {
    const strategy = product.quantityPricingStrategy || 'cap'
    const total = quantityTotalPrice(product.quantityTiers, qty, strategy, product.price)
    if (total != null) return total
  }
  const base = variant && typeof variant.price === 'number' ? variant.price : product.price
  return unitPriceForQty(base, qty, product.pricingMode, product.quantityTiers, product.quantityPricingStrategy || 'cap')
}

/**
 * Next quantity to move the stepper to in quantity mode: the adjacent
 * configured tier quantity in the given direction. Returns null when out of range.
 */
export function nextTierQuantity(tiers: QuantityTier[] | undefined | null, qty: number, dir: -1 | 1): number | null {
  const sorted = sortedTiers(tiers).filter((t) => isBundleTier(t))
  if (sorted.length === 0) return null
  const qtys = sorted.map((t) => t.quantity)
  const idx = qtys.indexOf(qty)
  const target = idx === -1 ? (dir === 1 ? 0 : qtys.length - 1) : idx + dir
  return qtys[target] ?? null
}

/**
 * Computes the savings breakdown for a quantity selection so the UI can show an
 * understandable offer to a normal customer.
 *
 * - `originalTotal` = unit base price × quantity (what it would cost without the offer).
 * - `offerTotal` = the bundle tier's TOTAL price (null when no tier applies).
 * - `savings` / `savingsPct` = how much the customer saves vs. the original total.
 *
 * Returns `hasOffer: false` for standard pricing or when no bundle tier matches,
 * in which case `offerTotal`/`savings`/`savingsPct` are null.
 */
export interface OfferSavings {
  originalTotal: number
  offerTotal: number | null
  savings: number | null
  savingsPct: number | null
  hasOffer: boolean
}
export function offerSavings(
  baseUnitPrice: number,
  qty: number,
  pricingMode?: string | null,
  tiers?: QuantityTier[] | null,
  strategy: QuantityPricingStrategy = 'cap',
): OfferSavings {
  const originalTotal = (baseUnitPrice || 0) * Math.max(1, qty)
  if (pricingMode === 'quantity' && tiers && tiers.length > 0 && tiers.every(isBundleTier)) {
    const offer = quantityTotalPrice(tiers, qty, strategy, baseUnitPrice)
    if (offer != null) {
      const savings = Math.max(0, originalTotal - offer)
      const savingsPct = originalTotal > 0 ? Math.round((savings / originalTotal) * 100) : 0
      return { originalTotal, offerTotal: offer, savings, savingsPct, hasOffer: true }
    }
  }
  return { originalTotal, offerTotal: null, savings: null, savingsPct: null, hasOffer: false }
}

/** Arabic label for a piece count, e.g. 1 قطعة / 2 قطعتان / 3 قطع. */
export function piecesLabel(n: number): string {
  if (n === 1) return 'قطعة'
  if (n === 2) return 'قطعتان'
  if (n <= 10) return 'قطع'
  return 'قطعة'
}

/** Validates tiers. Returns an Arabic error or null. */
export function validateQuantityTiers(tiers: QuantityTier[]): string | null {
  if (tiers.length === 0) return 'أضف مستوى سعرياً واحداً على الأقل'
  const seen = new Set<number>()
  for (const t of tiers) {
    const qty = t.quantity
    if (!Number.isInteger(qty) || qty < 1) return 'عدد القطع يجب أن يكون عدداً صحيحاً أكبر من صفر'
    if (typeof t.price !== 'number' || !Number.isFinite(t.price) || t.price < 0) return 'السعر الإجمالي يجب أن يكون أكبر من أو يساوي صفر'
    if (seen.has(qty)) return 'لا يمكن تكرار نفس عدد القطع'
    seen.add(qty)
  }
  return null
}
