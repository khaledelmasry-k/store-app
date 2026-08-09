import type { CartLine, Product, ProductVariant, QuantityTier } from '../types'

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
 * - bundle tiers: the tier's TOTAL `price`.
 * - legacy tiers: unit price (callers multiply by qty for compat).
 * Returns null when no tier applies.
 */
export function tierTotalForQuantity(tiers: QuantityTier[] | undefined | null, qty: number): number | null {
  if (tiers && tiers.length > 0 && tiers.every(isBundleTier)) {
    const tier = tierForQuantity(tiers, qty)
    return tier && typeof tier.price === 'number' ? tier.price : null
  }
  return null
}

/**
 * Resolves the effective unit price for a quantity.
 *
 * - quantity pricing: the matching tier price (or falls back to `basePrice`).
 * - standard pricing: `basePrice`.
 */
export function unitPriceForQty(basePrice: number, qty: number, pricingMode?: string | null, tiers?: QuantityTier[] | null): number {
  if (pricingMode === 'quantity') {
    const tier = tierForQuantity(tiers, qty)
    if (tier && typeof tier.price === 'number') return tier.price
  }
  return basePrice || 0
}

/**
 * Line total using the line's price snapshot + quantity pricing if present.
 *
 * Bundle tiers: returns the tier's TOTAL price (no multiplication).
 * Standard pricing / legacy tiers: returns unit price × quantity.
 */
export function lineSubtotal(line: CartLine): number {
  const qty = Math.max(1, line.quantity || 1)
  if (line.pricingMode === 'quantity' && line.quantityTiers && line.quantityTiers.length > 0) {
    const bundleTotal = tierTotalForQuantity(line.quantityTiers, qty)
    if (bundleTotal != null) return bundleTotal
    // Bundle tier snapshot lost the qty's tier → fall back to the charged total.
    if (typeof line.lineTotal === 'number') return line.lineTotal
    // Legacy unit-price tiers: unit × qty.
    const unit = unitPriceForQty(line.price, qty, line.pricingMode, line.quantityTiers)
    return unit * qty
  }
  if (typeof line.lineTotal === 'number') return line.lineTotal
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
export function productUnitPrice(product: Pick<Product, 'price' | 'variants' | 'pricingMode' | 'quantityTiers'>, variant: ProductVariant | undefined, qty: number): number {
  if (product.pricingMode === 'quantity') {
    const bundleTotal = tierTotalForQuantity(product.quantityTiers, qty)
    if (bundleTotal != null) return bundleTotal
  }
  const base = variant && typeof variant.price === 'number' ? variant.price : product.price
  return unitPriceForQty(base, qty, product.pricingMode, product.quantityTiers)
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
