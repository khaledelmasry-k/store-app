import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useDocument } from '../../shared/hooks/useDocument'
import { useCart } from '../../shared/hooks/useCart'
import { useToast } from '../../shared/hooks/useToast'
import { Button } from '../../shared/components/ui/Button'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { formatCurrency } from '../../shared/utils/format'
import { findVariant, imageIndexForColor, sizeInStock, variantPrice, variantStock } from '../../shared/utils/product-variants'
import { productUnitPrice, nextTierQuantity, tierForQuantity, offerSavings, piecesLabel } from '../../shared/utils/pricing'
import { setSeo } from '../../shared/utils/seo'
import type { Product } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import { StoreProductCard } from '../components/StoreProductCard'

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
    return (
      <div className="storefront-page storefront-product">
        <div className="store-empty-state">
          <Icon name="inventory_2" className="store-empty-icon" />
          <h2>المنتج غير موجود</h2>
          <p>هذا المنتج غير متوفر في هذا المتجر.</p>
          <Link href={`/store/${store?.slug}/catalog`} className="btn btn-primary">تصفح المنتجات</Link>
        </div>
      </div>
    )
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
  const selectedStock = selectionComplete ? variantStock(product, color, size, variant?.id) : totalStock

  const displayPrice = hasVariants && selectionComplete ? variantPrice(product, color, size, variant?.id) : product.price
  const unitPrice = productUnitPrice(product, variant, qty)
  const activeTier = tierForQuantity(product.quantityTiers, qty)
  const outOfStock = selectedStock <= 0
  const canAdd = selectionComplete && !outOfStock && product.active

  const discount =
    product.oldPrice && product.oldPrice > displayPrice
      ? Math.round(((product.oldPrice - displayPrice) / product.oldPrice) * 100)
      : 0

  const colorOptions = product.colorOptions && product.colorOptions.length ? product.colorOptions : (product.colors || []).map((n) => ({ name: n, hex: '#6366f1' }))

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

  const related: Product[] = []

  return (
    <div className="storefront-page storefront-product">
      <nav className="store-crumb" aria-label="خيط البيان">
        <Link href={`/store/${store?.slug}`}>الرئيسية</Link>
        <Icon name="chevron_left" ariaHidden />
        <Link href={`/store/${store?.slug}/catalog`}>المنتجات</Link>
        <Icon name="chevron_left" ariaHidden />
        <span>{product.name}</span>
      </nav>

      <div className="product-detail">
        <div className="product-gallery">
          {images.length > 0 && (
            <>
              <div className="product-gallery-main">
                <SmartImage
                  src={images[displayIndex] || images[0]}
                  alt={product.name}
                  className={`product-detail-img${store?.theme?.imageFit === 'cover' ? ' product-detail-img--cover' : ''}`}
                  placeholderClassName="product-detail-img"
                  loading="eager"
                />
                {discount > 0 && <span className="product-badge product-badge--sale">خصم {discount}%</span>}
              </div>
              {images.length > 1 && (
                <div className="product-gallery-thumbs">
                  {images.map((src, i) => (
                    <button key={i} type="button" className={`gallery-thumb${i === displayIndex ? ' gallery-thumb--active' : ''}`} onClick={() => setDisplayIndex(i)}>
                      <SmartImage src={src} alt="" placeholderClassName="gallery-thumb-fallback" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="product-info">
          <div className="product-avail">
            <span className={`product-avail-dot${outOfStock ? ' product-avail-dot--out' : ''}`} />
            <span>{outOfStock ? 'نفد المخزون' : `متوفر (${selectedStock} قطعة)`}</span>
          </div>

          <h1 className="page-title product-title">{product.name}</h1>

          <div className="product-price">
            <strong className="product-price-main">{formatCurrency(displayPrice, store?.currency)}</strong>
            {product.oldPrice && Number(product.oldPrice) > Number(displayPrice) && (
              <span className="product-old-price">{formatCurrency(product.oldPrice, store?.currency)}</span>
            )}
          </div>

          <p className="product-desc muted">{product.description}</p>

          <div className="product-options">
            {requiresColor && colorOptions.length > 0 && (
              <div className="product-colors">
                <span className="field-label">اللون</span>
                <div className="flex flex-wrap mt-1">
                  {colorOptions.map((c) => {
                    const active = color === c.name
                    return (
                      <button
                        key={c.name}
                        type="button"
                        className={`color-swatch${active ? ' color-swatch--active' : ''}`}
                        style={{ background: c.hex }}
                        onClick={() => selectColor(c.name)}
                        aria-label={c.name}
                        title={c.name}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {requiresSize && (
              <div className="product-sizes">
                <div className="flex items-center justify-between">
                  <span className="field-label">المقاس</span>
                  <span className="field-hint">دليل المقاسات</span>
                </div>
                <div className="flex flex-wrap mt-1">
                  {(product.sizes || []).map((s) => {
                    const disabled = hasVariants && !sizeInStock(product, color, s)
                    return (
                      <button
                        key={s}
                        type="button"
                        className={`size-chip${size === s ? ' size-chip--active' : ''}${disabled ? ' size-chip--disabled' : ''}`}
                        disabled={disabled}
                        onClick={() => { setSize(s); setQty(minQty) }}
                      >
                        {s}
                        {disabled && <span className="size-chip-soldout">نفد</span>}
                      </button>
                    )
                  })}
                </div>
                {requiresColor && !color && <p className="field-hint">اختر اللون أولاً.</p>}
              </div>
            )}

            {hasVariants && !selectionComplete && (
              <p className="field-hint">اختر اللون والمقاس لمعرفة التوفر.</p>
            )}

            {isQuantity && tiers.length > 0 && (
              <div className="qty-tier-table">
                <span className="field-label">اختر الكمية</span>
                <div className="qty-tier-list">
                  {tiers.map((t) => {
                    const sv = offerSavings(displayPrice, t.quantity, product.pricingMode, product.quantityTiers, product.quantityPricingStrategy)
                    const isActive = activeTier && activeTier.quantity === t.quantity
                    return (
                      <button
                        key={t.quantity}
                        type="button"
                        className={`qty-tier-row qty-tier-btn${isActive ? ' qty-tier-row--active' : ''}`}
                        onClick={() => setQty(t.quantity)}
                      >
                        <span>{t.quantity} {piecesLabel(t.quantity)}</span>
                        <span className="qty-tier-price">{formatCurrency(t.price, store?.currency)}</span>
                        {sv.hasOffer && (sv.savings ?? 0) > 0 && (
                          <span className="qty-tier-save">
                            {formatCurrency(sv.originalTotal, store?.currency)} وفر {formatCurrency(sv.savings!, store?.currency)} ({sv.savingsPct}%)
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="product-actions">
            <div className="qty-stepper">
              <button type="button" className="qty-btn" onClick={() => stepQty(-1)}>−</button>
              <strong>{qty}</strong>
              <button type="button" className="qty-btn" onClick={() => stepQty(1)}>+</button>
            </div>
            <Button icon="shopping_cart" onClick={addToCart} disabled={!canAdd} className="product-add-btn">أضف إلى السلة</Button>
            <button type="button" className="product-wishlist" title="إضافة للمفضلة">
              <Icon name="favorite_border" ariaHidden />
            </button>
          </div>

          <div className="product-trust">
            <div className="product-trust-item">
              <Icon name="local_shipping" ariaHidden />
              <div><h4>حد الشحن المجاني</h4><p>توصيل مجاني للطلبات فوق {formatCurrency(store?.shipping?.freeAbove || 500, store?.currency)}</p></div>
            </div>
            <div className="product-trust-item">
              <Icon name="support_agent" ariaHidden />
              <div><h4>دعم 24/7</h4><p>فريقنا جاهز لخدمتك. {store?.phone && <span className="ltr-text">{store.phone}</span>}</p></div>
            </div>
            <div className="product-trust-item">
              <Icon name="verified_user" ariaHidden />
              <div><h4>ضمان الاسترجاع</h4><p>إمكانية الاسترجاع خلال 14 يوماً</p></div>
            </div>
          </div>

          {related.length > 0 && (
            <section className="product-related">
              <h2 className="section-title">منتجات ذات صلة</h2>
              <div className="store-grid store-grid-featured">
                {related.map((p) => <StoreProductCard key={p.id} product={p} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
export default StoreProduct