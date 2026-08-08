import type { CartLine, Product, ProductVariant, QuantityTier } from '../types'

/**
 * Shared quantity-pricing engine.
 *
 * Single source of truth used by the product page, cart, checkout, and the
 * server (`functions/src/index.ts` mirrors this logic). Never duplicate tier
 * resolution in components.
 */

/** Returns the tier that applies for a given quantity, or null. */
export function tierForQuantity(tiers: QuantityTier[] | undefined | null, qty: number): QuantityTier | null {
  if (!tiers || tiers.length === 0 || qty < 1) return null
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity)
  for (const t of sorted) {
    if (qty >= t.minQuantity && (t.maxQuantity == null || qty <= t.maxQuantity)) return t
  }
  // If the quantity exceeds every tier's max, fall back to the highest tier.
  const last = sorted[sorted.length - 1]
  if (last && last.maxQuantity != null && qty > last.maxQuantity) return last
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

/** Line subtotal using the line's price snapshot + quantity pricing if present. */
export function lineSubtotal(line: CartLine): number {
  const unit = unitPriceForQty(line.price, line.quantity, line.pricingMode, line.quantityTiers)
  return unit * line.quantity
}

/** Cart subtotal = sum of line subtotals (uses quantity pricing). */
export function cartSubtotal(items: CartLine[]): number {
  return items.reduce((s, i) => s + lineSubtotal(i), 0)
}

/** Resolves the display price for a product page selection (variant override → tier → base). */
export function productUnitPrice(product: Pick<Product, 'price' | 'variants' | 'pricingMode' | 'quantityTiers'>, variant: ProductVariant | undefined, qty: number): number {
  const base = variant && typeof variant.price === 'number' ? variant.price : product.price
  return unitPriceForQty(base, qty, product.pricingMode, product.quantityTiers)
}

/** Validates tiers. Returns an Arabic error or null. */
export function validateQuantityTiers(tiers: QuantityTier[]): string | null {
  if (tiers.length === 0) return 'أضف مستوى سعرياً واحداً على الأقل'
  const seen = new Set<number>()
  for (const t of tiers) {
    if (!Number.isFinite(t.minQuantity) || t.minQuantity < 1) return 'كمية البداية يجب أن تكون أكبر من صفر'
    if (t.maxQuantity != null && t.maxQuantity < t.minQuantity) return 'كمية النهاية يجب أن تكون أكبر من كمية البداية'
    if (!Number.isFinite(t.price) || t.price <= 0) return 'السعر يجب أن يكون أكبر من صفر'
    if (seen.has(t.minQuantity)) return 'لا يمكن تكرار نفس كمية البداية'
    seen.add(t.minQuantity)
  }
  return null
}
