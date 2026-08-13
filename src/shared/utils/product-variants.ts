import type { Product, ProductVariant } from '../types'

export interface VariantMatch {
  variantId?: string
  color?: string
  size?: string
}

/** Finds the variant for an exact selection. Resolution order: variantId → exact
 * color+size → safe fallback. `match` fields may be empty (e.g. size-only or
 * color-only products). */
export function findVariant(product: Pick<Product, 'variants'>, match: VariantMatch): ProductVariant | undefined {
  const variants = product.variants || []
  // 1. Prefer exact variant identity — never collapse two variants that happen
  //    to share the same color/size labels but have different ids.
  if (match.variantId) {
    const byId = variants.find((v) => v.id === match.variantId)
    if (byId) return byId
  }
  const color = match.color || ''
  const size = match.size || ''
  // 2. Exact color+size combination.
  const exact = variants.find((v) => (v.color || '') === color && (v.size || '') === size)
  if (exact) return exact
  if (!color && !size) return undefined
  // 3. Safe legacy fallback: color-only or size-only.
  if (color && !size) return variants.find((v) => (v.color || '') === color && !(v.size || ''))
  if (size && !color) return variants.find((v) => !(v.color || '') && (v.size || '') === size)
  return undefined
}

/**
 * In-stock quantity for a selection. Resolution order (must agree with
 * findVariant): variantId → exact color+size → color-only aggregate →
 * size-only aggregate → product flat stock (legacy fallback).
 *
 * When `variantId` is supplied the lookup is anchored to that exact variant so
 * duplicate color/size labels with different ids never resolve to the wrong
 * stock figure.
 */
export function variantStock(
  product: Pick<Product, 'variants' | 'stock'>,
  color?: string,
  size?: string,
  variantId?: string,
): number {
  const variants = product.variants || []
  // 1. Exact variant identity.
  if (variantId) {
    const byId = variants.find((v) => v.id === variantId)
    if (byId) return byId.stock || 0
  }
  const colorNorm = color || ''
  const sizeNorm = size || ''
  // 2. Exact color+size.
  if (colorNorm && sizeNorm) {
    const v = variants.find((x) => (x.color || '') === colorNorm && (x.size || '') === sizeNorm)
    if (v) return v.stock || 0
  } else if (colorNorm && !sizeNorm) {
    // Color-only: aggregate across every size for that color.
    const matching = variants.filter((x) => (x.color || '') === colorNorm)
    if (matching.length > 0) return matching.reduce((s, x) => s + (x.stock || 0), 0)
  } else if (!colorNorm && sizeNorm) {
    // Size-only: aggregate across every color for that size.
    const matching = variants.filter((x) => (x.size || '') === sizeNorm)
    if (matching.length > 0) return matching.reduce((s, x) => s + (x.stock || 0), 0)
  }
  // 3. Legacy fallback: no variant match → product-level stock.
  return product.stock || 0
}

/**
 * Sizes that EXIST for a given color (regardless of stock). A size is listed
 * when at least one variant for that (color, size) exists. Out-of-stock
 * combinations are intentionally included so the UI can render them disabled
 * ("0") rather than hiding the combination entirely.
 */
export function availableSizes(
  product: Pick<Product, 'variants' | 'sizes' | 'stock'>,
  color?: string,
  variantId?: string,
): string[] {
  const sizes = product.sizes || []
  const variants = product.variants || []
  if (variants.length === 0) {
    return (product.stock ?? 0) > 0 ? sizes : []
  }
  // If a variantId pins the selection, only that variant's own size applies.
  if (variantId) {
    const byId = variants.find((v) => v.id === variantId)
    return byId ? [byId.size || ''] : []
  }
  const colorNorm = color || ''
  return sizes.filter((size) =>
    variants.some((v) => (v.color || '') === colorNorm && (v.size || '') === size),
  )
}

/** True when at least one in-stock variant exists for the (color, size) pair. */
export function sizeInStock(
  product: Pick<Product, 'variants' | 'sizes' | 'stock'>,
  color?: string,
  size?: string,
): boolean {
  const variants = product.variants || []
  if (variants.length === 0) return (product.stock ?? 0) > 0
  return variants.some(
    (v) => (v.color || '') === (color || '') && (v.size || '') === (size || '') && (v.stock || 0) > 0,
  )
}

/** Price for a complete selection. Prefers an exact variant (by id) so a
 * per-variant price override is matched to the right stock keeping unit. */
export function variantPrice(product: Pick<Product, 'price' | 'variants'>, color?: string, size?: string, variantId?: string): number {
  const v = variantId ? findVariant(product, { variantId }) : findVariant(product, { color, size })
  return v && typeof v.price === 'number' ? v.price : product.price
}

/** The primary image index for a selected color (ColorOption.imageIndex). */
export function imageIndexForColor(product: Pick<Product, 'colorOptions'>, color?: string): number | undefined {
  if (!color || !product.colorOptions) return undefined
  const opt = product.colorOptions.find((c) => c.name === color)
  return opt?.imageIndex
}
