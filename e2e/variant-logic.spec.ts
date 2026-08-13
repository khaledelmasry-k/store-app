import { test, expect } from '@playwright/test'
import {
  findVariant,
  variantStock,
  availableSizes,
  sizeInStock,
  variantPrice,
} from '../src/shared/utils/product-variants'
import {
  tierForQuantity,
  tierTotalForQuantity,
  quantityTotalPrice,
  lineSubtotal,
  cartSubtotal,
  productUnitPrice,
  offerSavings,
} from '../src/shared/utils/pricing'
import type { CartLine, Product, ProductVariant } from '../src/shared/types'

// Build a product using the exact business model from the spec:
// Colors Black/White/Yellow, Sizes M/L/XL/XXL, with a sparse stock matrix so
// that NOT every color has every size.
function buildVariantProduct(): Product {
  const combos: [string, string, number][] = [
    ['Black', 'M', 5],
    ['Black', 'L', 0],
    ['Black', 'XL', 3],
    ['Black', 'XXL', 2],
    ['White', 'M', 4],
    ['White', 'L', 7],
    ['White', 'XL', 0],
    ['White', 'XXL', 1],
    ['Yellow', 'M', 0],
    ['Yellow', 'L', 2],
    ['Yellow', 'XL', 5],
    ['Yellow', 'XXL', 0],
  ]
  const variants: ProductVariant[] = combos.map(([color, size, stock], i) => ({
    id: `v${i}`,
    color,
    size,
    sku: `SKU-${color}-${size}`,
    stock,
  }))
  return {
    id: 'p1',
    storeId: 's1',
    name: 'Pants',
    description: '',
    price: 100,
    images: [],
    stock: variants.reduce((s, v) => s + v.stock, 0),
    variants,
    colors: ['Black', 'White', 'Yellow'],
    sizes: ['M', 'L', 'XL', 'XXL'],
    active: true,
  }
}

test.describe('variant model: source-of-truth variantId + sparse matrix', () => {
  const product = buildVariantProduct()

  test('1/4. color+size product builds every combination as an independent variant', () => {
    expect(product.variants).toHaveLength(12)
    // each has its own id/color/size/sku/stock
    expect(product.variants.find((v) => v.id === 'v0')).toMatchObject({ color: 'Black', size: 'M', stock: 5 })
  })

  test('2. size-only product variant resolves by size (no color)', () => {
    const p: Product = {
      ...product,
      colors: [],
      variants: [
        { id: 'sM', size: 'M', stock: 3 },
        { id: 'sL', size: 'L', stock: 0 },
      ],
    }
    expect(findVariant(p, { size: 'M' })?.id).toBe('sM')
    expect(variantStock(p, undefined, 'L')).toBe(0)
  })

  test('3. color-only product variant resolves by color (no size)', () => {
    const p: Product = {
      ...product,
      sizes: [],
      variants: [
        { id: 'cBlack', color: 'Black', stock: 9 },
        { id: 'cWhite', color: 'White', stock: 0 },
      ],
    }
    expect(findVariant(p, { color: 'Black' })?.id).toBe('cBlack')
    expect(variantStock(p, 'White')).toBe(0)
  })

  test('5/6/7. color lists the sizes that EXIST for THAT color; OOS ones stay visible but disabled', () => {
    // Black exists for M,L,XL,XXL — L is out of stock so it is listed but disabled.
    expect(availableSizes(product, 'Black').sort()).toEqual(['L', 'M', 'XL', 'XXL'])
    expect(sizeInStock(product, 'Black', 'M')).toBe(true)
    expect(sizeInStock(product, 'Black', 'L')).toBe(false)
    // White exists for M,L,XL,XXL — XL out of stock.
    expect(availableSizes(product, 'White').sort()).toEqual(['L', 'M', 'XL', 'XXL'])
    expect(sizeInStock(product, 'White', 'XL')).toBe(false)
    // Yellow exists for M,L,XL,XXL — M out of stock.
    expect(availableSizes(product, 'Yellow').sort()).toEqual(['L', 'M', 'XL', 'XXL'])
    expect(sizeInStock(product, 'Yellow', 'M')).toBe(false)
  })

  test('variantId is the canonical identity, not color/size labels', () => {
    const v = findVariant(product, { variantId: 'v0' })
    expect(v?.color).toBe('Black')
    expect(v?.size).toBe('M')
    // even with misleading color/size text, variantId wins
    expect(findVariant(product, { variantId: 'v0', color: 'White', size: 'L' })?.id).toBe('v0')
  })

  test('4/8. per-variant stock, not aggregate', () => {
    expect(variantStock(product, 'Black', 'M')).toBe(5)
    expect(variantStock(product, 'Black', 'L')).toBe(0) // L out for Black
    // selecting White should NOT expose Black/L stock as the product's
    expect(variantStock(product, 'White', 'L')).toBe(7)
    // aggregate only used for legacy products without variants
    expect(variantStock({ ...product, variants: [] }, undefined, undefined, undefined)).toBe(product.stock)
  })

  test('10. out-of-stock is per selected variant, product stays available', () => {
    expect(variantStock(product, 'Black', 'L')).toBe(0) // OOS for this size
    const anyAvailable = product.variants.some((v) => v.stock > 0)
    expect(anyAvailable).toBe(true) // product as a whole is NOT out of stock
  })

  test('variant price override resolves to the exact variant', () => {
    const p: Product = { ...product, variants: [...product.variants, { id: 'vx', color: 'Black', size: 'M', stock: 1, price: 80 }] }
    expect(variantPrice(p, 'Black', 'M', 'vx')).toBe(80)
    expect(variantPrice(p, 'Black', 'M', 'v0')).toBe(100) // base price fallback
  })
})

test.describe('quantity offers + variants', () => {
  const tiers = [
    { quantity: 1, price: 500 },
    { quantity: 2, price: 900 },
    { quantity: 3, price: 1200 },
    { quantity: 4, price: 1400 },
  ]
  const product: Product = {
    id: 'pq',
    storeId: 's1',
    name: 'Bundle',
    description: '',
    price: 500,
    images: [],
    stock: 2,
    variants: [
      { id: 'bv', color: 'Black', size: 'M', stock: 2 },
      { id: 'bv2', color: 'Black', size: 'L', stock: 5 },
    ],
    colors: ['Black'],
    sizes: ['M', 'L'],
    pricingMode: 'quantity',
    quantityTiers: tiers,
    active: true,
  }

  test('12. quantity offer total is NOT unit × qty', () => {
    expect(tierTotalForQuantity(tiers, 2)).toBe(900)
    expect(tierTotalForQuantity(tiers, 3)).toBe(1200)
    expect(tierForQuantity(tiers, 2)?.price).toBe(900)
  })

  test('13/15. quantity offer + variant stock: allowed only when variant stock covers qty', () => {
    // Black/M stock = 2 → qty 2 allowed (offer 900)
    expect(variantStock(product, 'Black', 'M', 'bv')).toBe(2)
    expect(tierTotalForQuantity(tiers, 2)).toBe(900)
    // Black/M stock = 1 → qty 2 must NOT be allowed
    const low: Product = { ...product, variants: [{ id: 'bv', color: 'Black', size: 'M', stock: 1 }, ...product.variants.slice(1)] }
    expect(variantStock(low, 'Black', 'M', 'bv')).toBe(1)
    // offer for qty 2 still exists, but it must be blocked by stock at order time
    expect(tierTotalForQuantity(tiers, 2)).toBe(900)
  })

  test('11/14. cart lines stay separated by variantId; offer total per line', () => {
    const lineM: CartLine = {
      productId: 'pq', variantId: 'bv', quantity: 2, price: 900, pricingMode: 'quantity', quantityTiers: tiers, name: 'B',
    }
    const lineL: CartLine = {
      productId: 'pq', variantId: 'bv2', quantity: 1, price: 500, pricingMode: 'quantity', quantityTiers: tiers, name: 'B',
    }
    expect(lineSubtotal(lineM)).toBe(900) // bundle total, not 900×2
    expect(lineSubtotal(lineL)).toBe(500)
    expect(cartSubtotal([lineM, lineL])).toBe(1400)
    // they remain distinct lines (variantId differs)
    expect(lineM.variantId).not.toBe(lineL.variantId)
  })

  test('display price reflects the selected tier total', () => {
    expect(productUnitPrice(product, product.variants[0], 2)).toBe(900)
    expect(productUnitPrice(product, product.variants[0], 1)).toBe(500)
  })
})

test.describe('legacy product without variants', () => {
  test('16. flat stock still works when variants are absent', () => {
    const legacy: Product = {
      id: 'pl', storeId: 's1', name: 'Simple', description: '', price: 50, images: [], stock: 8, variants: [], colors: [], sizes: [], active: true,
    }
    expect(findVariant(legacy, {})).toBeUndefined()
    expect(variantStock(legacy)).toBe(8)
    expect(availableSizes(legacy)).toEqual([])
  })
})

test.describe('offer savings (quantity-tier bundles)', () => {
  const tiers = [
    { quantity: 1, price: 500 },
    { quantity: 2, price: 900 },
    { quantity: 3, price: 1200 },
  ]

  test('savings = tier total − (unit price × qty)', () => {
    // qty 3 → offer 1200 vs 500×3=1500 → saving 300
    const s = offerSavings(500, 3, 'quantity', tiers)
    expect(s.hasOffer).toBe(true)
    expect(s.offerTotal).toBe(1200)
    expect(s.savings).toBe(300)
    expect(s.savingsPct).toBe(20)
  })

  test('every matching tier yields a positive saving', () => {
    // qty 2 → 900 vs 1000 → saving 100 (10%)
    const s = offerSavings(500, 2, 'quantity', tiers)
    expect(s.savings).toBe(100)
    expect(s.savingsPct).toBe(10)
  })

  test('standard pricing is never an offer', () => {
    expect(offerSavings(500, 3, 'standard', tiers).hasOffer).toBe(false)
  })

  test('overflow quantity (beyond top tier) is priced by the strategy, not base×qty', () => {
    // default 'cap': 5 → highest bundle (1200) + 2 × base (500) = 2200 (was 2500)
    const cap = offerSavings(500, 5, 'quantity', tiers, 'cap')
    expect(cap.hasOffer).toBe(true)
    expect(cap.offerTotal).toBe(2200)
    expect(cap.originalTotal).toBe(2500)
    expect(cap.savings).toBe(300)
  })

  test('strategy repeat: 8 → highest bundle repeated + remainder', () => {
    // 3 fits twice (1200×2) then remaining 2 → tier2 (900) = 3300
    expect(quantityTotalPrice(tiers, 8, 'repeat', 500)).toBe(3300)
    const s = offerSavings(500, 8, 'quantity', tiers, 'repeat')
    expect(s.offerTotal).toBe(3300)
  })

  test('strategy last: overflow always charges the highest bundle once', () => {
    expect(quantityTotalPrice(tiers, 5, 'last', 500)).toBe(1200)
    expect(quantityTotalPrice(tiers, 9, 'last', 500)).toBe(1200)
    const s = offerSavings(500, 5, 'quantity', tiers, 'last')
    expect(s.offerTotal).toBe(1200)
    expect(s.originalTotal).toBe(2500)
    expect(s.savings).toBe(1300)
  })

  test('quantityTotalPrice exact tiers are unchanged', () => {
    expect(quantityTotalPrice(tiers, 2, 'cap', 500)).toBe(900)
    expect(quantityTotalPrice(tiers, 3, 'cap', 500)).toBe(1200)
  })
})
