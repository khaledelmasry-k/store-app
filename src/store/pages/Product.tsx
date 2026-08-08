import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useDocument } from '../../shared/hooks/useDocument'
import { useCart } from '../../shared/hooks/useCart'
import { useToast } from '../../shared/hooks/useToast'
import { Button } from '../../shared/components/ui/Button'
import { Badge } from '../../shared/components/ui/Badge'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { formatCurrency } from '../../shared/utils/format'
import { availableSizes, findVariant, imageIndexForColor, variantPrice, variantStock } from '../../shared/utils/product-variants'
import { productUnitPrice, tierForQuantity } from '../../shared/utils/pricing'
import type { Product } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'

interface Props {
  id: string
}

export const StoreProduct: FunctionalComponent<Props> = ({ id }) => {
  const { store } = useStore()
  const { data: product, loading } = useDocument<Product>('products', id)
  const cart = useCart()
  const toast = useToast()
  const [qty, setQty] = useState(1)
  const [color, setColor] = useState('')
  const [size, setSize] = useState('')
  const [displayIndex, setDisplayIndex] = useState(0)

  if (loading) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>

  if (!product || product.storeId !== store?.id) {
    return <EmptyState icon="inventory_2" title="المنتج غير موجود" description="هذا المنتج غير متوفر في هذا المتجر." />
  }

  const images = product.images || []
  const hasVariants = (product.variants || []).length > 0
  const requiresColor = hasVariants && (product.colors || []).length > 0
  const requiresSize = hasVariants && (product.sizes || []).length > 0
  const selectionComplete = (!requiresColor || !!color) && (!requiresSize || !!size)

  const availSizes = availableSizes(product, color)
  const totalStock = hasVariants ? (product.variants || []).reduce((s, v) => s + (v.stock || 0), 0) : product.stock
  const selectedStock = selectionComplete ? variantStock(product, color, size) : totalStock

  const variant = hasVariants && selectionComplete ? findVariant(product, { color, size }) : undefined
  const displayPrice = hasVariants && selectionComplete && variant ? variantPrice(product, color, size) : product.price
  const unitPrice = productUnitPrice(product, variant, qty)
  const activeTier = tierForQuantity(product.quantityTiers, qty)
  const outOfStock = selectedStock <= 0
  const canAdd = selectionComplete && !outOfStock && product.active

  const selectColor = (c: string) => {
    setColor(c)
    const idx = imageIndexForColor(product, c)
    if (idx != null && images[idx]) setDisplayIndex(idx)
    setSize('')
    setQty(1)
  }

  const addToCart = () => {
    if (!canAdd) return
    cart.add({
      productId: product.id,
      name: product.name,
      price: unitPrice,
      image: images[displayIndex],
      quantity: qty,
      color: color || undefined,
      size: size || undefined,
      variantId: variant?.id,
      pricingMode: product.pricingMode,
      quantityTiers: product.quantityTiers,
    })
    toast.push('تمت إضافة المنتج إلى السلة')
  }

  return (
    <div>
      <div className="store-crumb">
        <Link href={`/store/${store?.slug}`}>الرئيسية</Link>
        <Icon name="chevron_left" />
        <Link href={`/store/${store?.slug}/catalog`}>المنتجات</Link>
        <Icon name="chevron_left" />
        <span>{product.name}</span>
      </div>

      <div className="product-detail">
        <div>
          {images.length === 0 ? (
            <div className="product-detail-empty">
              <Icon name="image" />
              <span className="muted">لا توجد صورة لهذا المنتج</span>
            </div>
          ) : (
            <FragmentGallery images={images} displayIndex={displayIndex} setDisplayIndex={setDisplayIndex} name={product.name} />
          )}
        </div>

        <div>
          <h1 className="page-title">{product.name}</h1>
          <div className="mt-1 mb-1">
            <Badge tone={outOfStock ? 'red' : 'green'}>{outOfStock ? 'نفد المخزون' : 'متوفر'}</Badge>
          </div>
          <p className="stat-value mb-2">
            {formatCurrency(unitPrice)}
            {product.oldPrice && Number(product.oldPrice) > displayPrice && <span className="store-card-old">{formatCurrency(product.oldPrice)}</span>}
          </p>
          {product.pricingMode === 'quantity' && product.quantityTiers && product.quantityTiers.length > 0 && (
            <div className="qty-tier-table mb-2">
              <span className="field-label">السعر حسب الكمية</span>
              <div className="qty-tier-list">
                {[...product.quantityTiers]
                  .sort((a, b) => a.minQuantity - b.minQuantity)
                  .map((t) => (
                    <div key={t.minQuantity} className={`qty-tier-row${activeTier && activeTier.minQuantity === t.minQuantity ? ' qty-tier-row--active' : ''}`}>
                      <span>
                        {t.minQuantity} {t.minQuantity === 1 ? 'قطعة' : t.minQuantity === 2 ? 'قطعتان' : t.minQuantity <= 10 ? 'قطع' : 'قطعة'}
                        {t.maxQuantity != null ? ` – ${t.maxQuantity}` : '+'}
                      </span>
                      <span>{formatCurrency(t.price)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
          <p className="muted mb-2">{product.description}</p>

          {(product.colors || []).length > 0 && (
            <div className="mb-2">
              <span className="field-label">اللون:</span>
              <div className="flex flex-wrap mt-1">
                {(product.colors || []).map((c) => {
                  const opt = (product.colorOptions || []).find((o) => o.name === c)
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`btn color-btn${color === c ? ' color-btn--active' : ''}`}
                      onClick={() => selectColor(c)}
                    >
                      {opt && <span className="color-btn-swatch" style={{ background: opt.hex }} />}
                      {c}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {(product.sizes || []).length > 0 && (
            <div className="mb-2">
              <span className="field-label">المقاس:</span>
              <div className="flex flex-wrap mt-1">
                {(product.sizes || []).map((s) => {
                  const disabled = hasVariants && !availSizes.includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`btn size-btn${size === s ? ' size-btn--active' : ''}${disabled ? ' size-btn--disabled' : ''}`}
                      disabled={disabled}
                      onClick={() => { setSize(s); setQty(1) }}
                    >
                      {s}
                      {disabled && <span className="size-btn-soldout">نفد</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {hasVariants && !selectionComplete && (
            <p className="field-hint mb-2">
              {requiresColor && !color && 'اختر اللون أولاً. '}
              {requiresSize && !size && 'اختر المقاس لمعرفة التوفر. '}
            </p>
          )}

          <div className="flex mb-2">
            <div className="qty-stepper">
              <button type="button" className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <strong>{qty}</strong>
              <button type="button" className="qty-btn" onClick={() => setQty(Math.min(Math.max(selectedStock, 1), qty + 1))}>+</button>
            </div>
            <span className="muted small" style={{ alignSelf: 'center' }}>{selectedStock > 0 ? `متوفر: ${selectedStock}` : 'غير متوفر حالياً'}</span>
          </div>

          <div className="flex flex-wrap">
            <Button icon="shopping_cart" onClick={addToCart} disabled={!canAdd}>أضف إلى السلة</Button>
            <Link href={`/store/${store?.slug}/cart`}><Button variant="outline">عرض السلة</Button></Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function FragmentGallery({ images, displayIndex, setDisplayIndex, name }: {
  images: string[]
  displayIndex: number
  setDisplayIndex: (i: number) => void
  name: string
}) {
  return (
    <div>
      <SmartImage src={images[displayIndex] || images[0]} alt={name} className="product-detail-img" placeholderClassName="product-detail-img" loading="eager" />
      {images.length > 1 && (
        <div className="product-gallery-thumbs">
          {images.map((src, i) => (
            <button key={i} type="button" className={`gallery-thumb${i === displayIndex ? ' gallery-thumb--active' : ''}`} onClick={() => setDisplayIndex(i)}>
              <SmartImage src={src} alt="" placeholderClassName="gallery-thumb-fallback" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
export default StoreProduct
