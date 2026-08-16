import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
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
import { findVariant, imageIndexForColor, sizeInStock, variantPrice, variantStock } from '../../shared/utils/product-variants'
import { productUnitPrice, nextTierQuantity, tierForQuantity, offerSavings, piecesLabel } from '../../shared/utils/pricing'
import { setSeo } from '../../shared/utils/seo'
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

  useEffect(() => {
    if (product?.pricingMode !== 'quantity') return
    const first = [...(product.quantityTiers || [])]
      .filter((t) => typeof t.quantity === 'number')
      .sort((a, b) => a.quantity - b.quantity)[0]
    if (first && qty !== first.quantity) setQty(first.quantity)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, product?.pricingMode, product?.quantityTiers?.length])

  useEffect(() => {
    if (!product || !store?.name) return
    const price = product.price ? ` — ${formatCurrency(product.price, store.currency)}` : ''
    setSeo({
      title: `${product.name}${price} | ${store.name}`,
      description: product.description || `تسوق ${product.name} من ${store.name} على منصة M&K`,
      type: 'product',
      url: `${window.location.origin}/store/${store.slug}/product/${product.id}`,
      image: (product.images && product.images[0]) || store.logo || null,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, product?.name, product?.description, product?.price, product?.images, store?.name, store?.slug, store?.currency, store?.logo])

  if (loading) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>

  if (!product || product.storeId !== store?.id) {
    return <EmptyState icon="inventory_2" title="المنتج غير موجود" description="هذا المنتج غير متوفر في هذا المتجر." />
  }

  const images = product.images || []
  const hasVariants = (product.variants || []).length > 0
  const requiresColor = hasVariants && (product.colors || []).length > 0
  const requiresSize = hasVariants && (product.sizes || []).length > 0
  const selectionComplete = (!requiresColor || !!color) && (!requiresSize || !!size)

  const isQuantity = product.pricingMode === 'quantity'
  const tiers = isQuantity
    ? [...(product.quantityTiers || [])].filter((t) => typeof t.quantity === 'number').sort((a, b) => a.quantity - b.quantity)
    : []
  const minQty = tiers.length > 0 ? tiers[0].quantity : 1

   const totalStock = hasVariants ? (product.variants || []).reduce((s, v) => s + (v.stock || 0), 0) : product.stock
   const variant = hasVariants && selectionComplete ? findVariant(product, { color, size }) : undefined
   // Resolve stock anchored on the exact variant identity (variantId) so
   // duplicate color/size labels with different ids never read the wrong stock.
   const selectedStock = selectionComplete ? variantStock(product, color, size, variant?.id) : totalStock

   const displayPrice = hasVariants && selectionComplete ? variantPrice(product, color, size, variant?.id) : product.price
  const unitPrice = productUnitPrice(product, variant, qty)
  const activeTier = tierForQuantity(product.quantityTiers, qty)
  const outOfStock = selectedStock <= 0
  const canAdd = selectionComplete && !outOfStock && product.active

  const selectColor = (c: string) => {
    setColor(c)
    const idx = imageIndexForColor(product, c)
    if (idx != null && images[idx]) setDisplayIndex(idx)
    setSize('')
    setQty(minQty)
  }

  const stepQty = (dir: -1 | 1) => {
    if (isQuantity) {
      const next = nextTierQuantity(tiers, qty, dir)
      if (next != null) setQty(next)
    } else {
      setQty((q) => (dir === 1 ? Math.min(Math.max(selectedStock, 1), q + 1) : Math.max(1, q - 1)))
    }
  }

  const addToCart = () => {
    if (!canAdd) return
    // Never add more than the available in-stock units for this selection.
    // For quantity (bundle) pricing a configured tier may legally exceed the
    // available stock — surface that instead of silently overselling.
    if (qty > Math.max(selectedStock, 0)) {
      toast.push('الكمية غير متوفرة', 'الكمية المطلوبة غير متوفرة لهذه المجموعة.', 'error')
      return
    }
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
      quantityPricingStrategy: product.quantityPricingStrategy,
      lineTotal: product.pricingMode === 'quantity' ? unitPrice : unitPrice * qty,
      maxQty: Math.max(selectedStock, 0),
    })
    toast.push('تمت الإضافة إلى السلة')
  }

  return (
    <div className="storefront-page storefront-product">
      <div className="store-crumb">
        <Link href={`/store/${store?.slug}`}>الرئيسية</Link>
        <Icon name="chevron_left" />
        <Link href={`/store/${store?.slug}/catalog`}>المنتجات</Link>
        <Icon name="chevron_left" />
        <span>{product.name}</span>
      </div>

      <div className="product-detail store-product-workspace">
        <div>
          {images.length === 0 ? (
            <div className="product-detail-empty">
              <Icon name="image" />
              <span className="muted">لا توجد صورة لهذا المنتج</span>
            </div>
          ) : (
            <FragmentGallery images={images} displayIndex={displayIndex} setDisplayIndex={setDisplayIndex} name={product.name} imageFit={store?.theme?.imageFit || 'contain'} />
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
          {isQuantity && tiers.length > 0 && (
            <div className="qty-tier-table mb-2">
              <span className="field-label">اختر العرض</span>
              <div className="qty-tier-list">
                {tiers.map((t) => {
                  const sv = offerSavings(displayPrice, t.quantity, product.pricingMode, product.quantityTiers, product.quantityPricingStrategy)
                  return (
                    <button
                      key={t.quantity}
                      type="button"
                      className={`qty-tier-row qty-tier-btn${activeTier && activeTier.quantity === t.quantity ? ' qty-tier-row--active' : ''}`}
                      onClick={() => setQty(t.quantity)}
                    >
                      <span>{t.quantity} {piecesLabel(t.quantity)}</span>
                      <span className="qty-tier-price">{formatCurrency(t.price)}</span>
                      {sv.hasOffer && (sv.savings ?? 0) > 0 && (
                        <span className="qty-tier-save">
                          <s>{formatCurrency(sv.originalTotal)}</s> وفر {formatCurrency(sv.savings!)} ({sv.savingsPct}%)
                        </span>
                      )}
                    </button>
                  )
                })}
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
                  const disabled = hasVariants && !sizeInStock(product, color, s)
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`btn size-btn${size === s ? ' size-btn--active' : ''}${disabled ? ' size-btn--disabled' : ''}`}
                      disabled={disabled}
                      onClick={() => { setSize(s); setQty(minQty) }}
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
              <button type="button" className="qty-btn" onClick={() => stepQty(-1)}>−</button>
              <strong>{qty}</strong>
              <button type="button" className="qty-btn" onClick={() => stepQty(1)}>+</button>
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

function FragmentGallery({ images, displayIndex, setDisplayIndex, name, imageFit }: {
  images: string[]
  displayIndex: number
  setDisplayIndex: (i: number) => void
  name: string
  imageFit: 'contain' | 'cover'
}) {
  return (
    <div>
      <SmartImage
        src={images[displayIndex] || images[0]}
        alt={name}
        className={`product-detail-img${imageFit === 'cover' ? ' product-detail-img--cover' : ''}`}
        placeholderClassName="product-detail-img"
        loading="eager"
      />
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
