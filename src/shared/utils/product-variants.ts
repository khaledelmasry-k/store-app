import type { Product, ProductVariant } from '../types'

export interface VariantMatch {
  variantId?: string
  color?: string
  size?: string
}

/** Finds the variant for an exact selection (by id, or color+size, either may be empty). */
export function findVariant(product: Pick<Product, 'variants'>, match: VariantMatch): ProductVariant | undefined {
  const variants = product.variants || []
  if (match.variantId) {
    const byId = variants.find((v) => v.id === match.variantId)
    if (byId) return byId
  }
  const color = match.color || ''
  const size = match.size || ''
  return variants.find((v) => (v.color || '') === color && (v.size || '') === size)
}

/** Combined in-stock quantity of all variants matching the selection. */
export function variantStock(
  product: Pick<Product, 'variants' | 'stock'>,
  color?: string,
  size?: string,
): number {
  const variants = product.variants || []
  const colorNorm = color || ''
  const sizeNorm = size || ''
  if (colorNorm && sizeNorm) {
    const v = variants.find((x) => (x.color || '') === colorNorm && (x.size || '') === sizeNorm)
    if (v) return v.stock || 0
  } else if (colorNorm && !sizeNorm) {
    const matching = variants.filter((x) => (x.color || '') === colorNorm)
    if (matching.length > 0) return matching.reduce((s, x) => s + (x.stock || 0), 0)
  } else if (!colorNorm && sizeNorm) {
    const matching = variants.filter((x) => (x.size || '') === sizeNorm)
    if (matching.length > 0) return matching.reduce((s, x) => s + (x.stock || 0), 0)
  }
  return product.stock || 0
}

/**
 * Sizes the customer can select for a given color. When the product has
 * variants, a size is available only if at least one variant for that color is
 * in stock. Without variants, all sizes are available when flat stock > 0.
 */
export function availableSizes(
  product: Pick<Product, 'variants' | 'sizes' | 'stock'>,
  color?: string,
): string[] {
  const sizes = product.sizes || []
  const variants = product.variants || []
  if (variants.length === 0) {
    return (product.stock ?? 0) > 0 ? sizes : []
  }
  const colorNorm = color || ''
  return sizes.filter((size) =>
    variants.some(
      (v) => (v.color || '') === colorNorm && (v.size || '') === size && (v.stock || 0) > 0,
    ),
  )
}

/** Price for a complete selection (variant price overrides product price). */
export function variantPrice(product: Pick<Product, 'price' | 'variants'>, color?: string, size?: string): number {
  const v = findVariant(product, { color, size })
  return v && typeof v.price === 'number' ? v.price : product.price
}

/** The primary image index for a selected color (ColorOption.imageIndex). */
export function imageIndexForColor(product: Pick<Product, 'colorOptions'>, color?: string): number | undefined {
  if (!color || !product.colorOptions) return undefined
  const opt = product.colorOptions.find((c) => c.name === color)
  return opt?.imageIndex
}
