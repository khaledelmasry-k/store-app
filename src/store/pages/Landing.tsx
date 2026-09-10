import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { useCart } from '../../shared/hooks/useCart'
import { useToast } from '../../shared/hooks/useToast'
import { getPublicLandingPageCallable, recordLandingPageViewCallable, recordStoreLinkVisitCallable } from '../../shared/services/auth'
import { Button } from '../../shared/components/ui/Button'
import { Badge } from '../../shared/components/ui/Badge'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Loading } from '../../shared/components/ui/Loading'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { MerchantLogo } from '../../shared/components/brand/MerchantLogo'
import { getTemplate } from '../../shared/utils/themes'
import { formatCurrency } from '../../shared/utils/format'
import { productUnitPrice, tierForQuantity, nextTierQuantity, offerSavings, piecesLabel } from '../../shared/utils/pricing'
import { findVariant, sizeInStock, variantStock } from '../../shared/utils/product-variants'
import { themeStyleFor } from '../../shared/components/layout/StoreLayout'
import type { LandingPage, LandingSection, Product, Store } from '../../shared/types'
import { visitEventId } from '../../shared/utils/visit-event'
import { Icon } from '../../shared/components/ui/Icon'

interface Props {
  slug: string
}

type PublicLanding = Pick<LandingPage, 'id' | 'slug' | 'title' | 'template' | 'hero' | 'sections' | 'productId' | 'seo'>

function LandingSectionView({ section, storeSlug }: { section: LandingSection; storeSlug: string }) {
  const items = section.items || []
  const sectionImg = (section.image || '').trim()
  const heading = (
    <div>
      {section.title && <h2 className="lp-section-title">{section.title}</h2>}
      {section.body && <p className="lp-section-desc">{section.body}</p>}
      {sectionImg && <SmartImage src={sectionImg} alt={section.title || ''} className="lp-section-img" placeholderClassName="lp-section-img" loading="lazy" />}
    </div>
  )
  switch (section.type) {
    case 'features':
      return (
        <section className="lp-section">
          <div className="lp-container">
            {heading}
            {items.length > 0 && (
              <div className="lp-grid lp-grid-3">
                {items.map((it, i) => (
                  <div className="lp-card" key={i}>
                    <div className="lp-card-icon"><Icon name="check_circle" /></div>
                    <h3>{it.title}</h3>
                    {it.body && <p className="muted small">{it.body}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )
    case 'steps':
      return (
        <section className="lp-section lp-section-soft">
          <div className="lp-container">
            {heading}
            {items.length > 0 && (
              <div className="lp-steps">
                {items.map((it, i) => (
                  <div className="lp-step" key={i}>
                    <span className="lp-step-num">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>{it.title}</h3>
                      {it.body && <p className="muted small">{it.body}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )
    case 'testimonials':
      return (
        <section className="lp-section">
          <div className="lp-container">
            {heading}
            {items.length > 0 && (
              <div className="lp-grid lp-grid-3">
                {items.map((it, i) => (
                  <div className="lp-card lp-quote" key={i}>
                    <Icon name="format_quote" className="lp-quote-icon" />
                    <p>{it.body}</p>
                    {it.title && <strong className="small">{it.title}</strong>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )
    case 'faq':
      return (
        <section className="lp-section lp-section-soft">
          <div className="lp-container lp-narrow">
            {heading}
            {items.length > 0 && (
              <div className="lp-faq">
                {items.map((it, i) => (
                  <details className="lp-faq-item" key={i}>
                    <summary>{it.title}</summary>
                    <p className="muted small">{it.body}</p>
                  </details>
                ))}
              </div>
            )}
          </div>
        </section>
      )
    case 'cta':
      return (
        <section className={`lp-section lp-cta-band${sectionImg ? ' lp-cta-band--img' : ''}`}>
          {sectionImg && <SmartImage src={sectionImg} alt="" className="lp-cta-band-img" placeholderClassName="lp-cta-band-img" loading="lazy" />}
          <div className="lp-container lp-narrow">
            {heading}
            <Link href={`/store/${storeSlug}`}><Button icon="storefront">زيارة المتجر</Button></Link>
          </div>
        </section>
      )
    default:
      return null
  }
}

/**
 * Public landing page at `/landing/:slug`. The callable returns a sanitized
 * landing/store/product projection, so this standalone route never reads the
 * internal landingPages document from the browser. Includes an embedded
 * QuickBuy panel for the featured product.
 */
export const StoreLanding: FunctionalComponent<Props> = ({ slug }) => {
  const [landing, setLanding] = useState<PublicLanding | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [store, setStore] = useState<Store | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const cart = useCart()
  const toast = useToast()
  const [qty, setQty] = useState(1)
  const [color, setColor] = useState('')
  const [size, setSize] = useState('')

  useEffect(() => {
    if (!slug) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setNotFound(false)
    let cancelled = false
    getPublicLandingPageCallable({ slug })
      .then((result) => {
        if (cancelled) return
        const payload = result.data as { landing?: PublicLanding; store?: Store; product?: Product | null }
        if (!payload.landing || !payload.store) {
          setNotFound(true)
        } else {
          setLanding(payload.landing)
          setStore(payload.store)
          setProduct(payload.product || null)
        }
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setNotFound(true)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [slug])

  // In quantity mode the QuickBuy must start on a configured tier quantity.
  useEffect(() => {
    if (product?.pricingMode !== 'quantity') return
    const first = [...(product.quantityTiers || [])]
      .filter((t) => typeof t.quantity === 'number')
      .sort((a, b) => a.quantity - b.quantity)[0]
    if (first && qty !== first.quantity) setQty(first.quantity)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, product?.pricingMode, product?.quantityTiers?.length])

  // Attribution + analytics once the landing and its store are resolved.
  useEffect(() => {
    if (!landing || !store?.id) return
    sessionStorage.setItem(`mk_landing_${store.id}`, landing.id)    // Pin the cart to this store so QuickBuy items reach the storefront cart.
    cart.setScopeSlug(store.slug || null)

    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      sessionStorage.setItem(`mk_sales_ref_${store.id}`, ref)
      recordStoreLinkVisitCallable({ storeId: store.id, code: ref, eventId: visitEventId(`sales_${store.id}_${ref}`) }).catch(() => {})
    }

    recordLandingPageViewCallable({ landingPageId: landing.id, eventId: visitEventId(`landing_${landing.id}`) }).catch(() => {})
  }, [landing, store?.id])

  if (loading) return <Loading />

  if (notFound || !landing || !store) {
    return (
      <div className="loading-screen">
        <EmptyState
          title="الصفحة غير موجودة"
          description="هذه الصفحة غير متاحة أو تم إيقافها."
          icon="web"
          action={<button className="btn btn-primary" onClick={() => (window.location.href = '/')}>العودة للرئيسية</button>}
        />
      </div>
    )
  }

  const templateClass = getTemplate(store?.theme?.template).cssClass
  const storeDark = store?.theme?.darkMode ? ' store-dark' : ''
  const sections = Array.isArray(landing.sections) ? landing.sections : []
  const hero = landing.hero || { title: landing.title }
  const heroImage = hero.image || ''

  const hasVariants = product && (product.variants || []).length > 0
  const requiresColor = hasVariants && (product.colors || []).length > 0
  const requiresSize = hasVariants && (product.sizes || []).length > 0
  const selectionComplete = (!requiresColor || !!color) && (!requiresSize || !!size)
  const variant = hasVariants && selectionComplete ? findVariant(product!, { color, size }) : undefined
  const displayPrice = hasVariants && selectionComplete ? (variant?.price ?? product!.price) : product?.price
  const unitPrice = product ? productUnitPrice(product, variant, qty) : 0
  const activeTier = tierForQuantity(product?.quantityTiers, qty)
  const isQuantity = product?.pricingMode === 'quantity'
  const tiers = isQuantity
    ? [...(product?.quantityTiers || [])].filter((t) => typeof t.quantity === 'number').sort((a, b) => a.quantity - b.quantity)
    : []
  const minQty = tiers.length > 0 ? tiers[0].quantity : 1

  const stepQty = (dir: -1 | 1) => {
    if (isQuantity) {
      const next = nextTierQuantity(tiers, qty, dir)
      if (next != null) setQty(next)
    } else {
      setQty(Math.max(1, qty + dir))
    }
  }
  const outOfStock = product ? variantStock(product, color, size, variant?.id) <= 0 : true
  // Gate on the cart being pinned to this store: `setScopeSlug` is applied in an
  // effect, so until it flushes the add would land in the unscoped `mk-cart` key.
  const scopePinned = !!store?.slug && cart.scopeSlug === store.slug
  const canAdd = !!product && product.active && selectionComplete && !outOfStock && scopePinned

  const addToCart = () => {
    if (!canAdd || !product) return
    // Never add more than the in-stock units for the current selection.
    // For quantity (bundle) pricing a configured tier may legally exceed the
    // available stock — surface that instead of silently overselling.
    const availStock = hasVariants ? variantStock(product!, color, size, variant?.id) : product.stock ?? 0
    if (qty > Math.max(availStock, 0)) {
      toast.push('الكمية غير متوفرة', 'الكمية المطلوبة غير متوفرة لهذه المجموعة.', 'error')
      return
    }
    cart.add({
      productId: product.id,
      name: product.name,
      price: unitPrice,
      image: (product.images || [])[0],
      quantity: qty,
      color: color || undefined,
      size: size || undefined,
      variantId: variant?.id,
      pricingMode: product.pricingMode,
      quantityTiers: product.quantityTiers,
      quantityPricingStrategy: product.quantityPricingStrategy,
      lineTotal: product.pricingMode === 'quantity' ? unitPrice : unitPrice * qty,
      maxQty: Math.max(availStock, 0),
    })
    toast.push('تمت إضافة المنتج إلى السلة')
  }

  return (
    <div className={`lp-shell ${templateClass}${storeDark}`} style={themeStyleFor(store?.theme?.primary, store?.theme?.secondary)}>
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link href={`/store/${store?.slug}`} className="lp-brand">
             <MerchantLogo store={store} variant="landing" />
          </Link>
          <Link href={`/store/${store?.slug}`} className="btn btn-outline btn-sm">زيارة المتجر</Link>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-container lp-hero-inner">
            <div className="lp-hero-copy">
              <h1>{hero.title || landing.title}</h1>
              {hero.subtitle && <p className="lp-hero-sub">{hero.subtitle}</p>}
              {product && (
                <div className="lp-hero-actions">
                  <a href="#lp-buy" className="btn btn-primary btn-lg">{hero.ctaText || 'اطلب الآن'}</a>
                  <Link href={`/store/${store?.slug}`}><Button variant="ghost" icon="arrow_downward">استعرض المتجر</Button></Link>
                </div>
              )}
            </div>
            {heroImage && (
              <div className="lp-hero-media">
                <SmartImage src={heroImage} alt="" className="lp-hero-img" placeholderClassName="lp-hero-img" loading="eager" />
              </div>
            )}
          </div>
        </section>

        {sections.map((s, i) => (
          <LandingSectionView key={i} section={s} storeSlug={store?.slug || ''} />
        ))}

        {product && (
          <section className="lp-section lp-buy" id="lp-buy">
            <div className="lp-container">
              <div className="lp-buy-card">
                <div className="lp-buy-media">
                  {(product.images || []).length > 0 ? (
                    <SmartImage src={product.images[0]} alt={product.name} className="lp-buy-img" placeholderClassName="lp-buy-img" loading="eager" fallback="product" />
                  ) : (
                    <div className="product-detail-empty"><Icon name="image" /><span className="muted">لا توجد صورة</span></div>
                  )}
                </div>
                <div className="lp-buy-body">
                  <h2>{product.name}</h2>
                  <div className="mt-1 mb-1">
                    <Badge tone={outOfStock ? 'red' : 'green'}>{outOfStock ? 'نفد المخزون' : 'متوفر'}</Badge>
                  </div>
                  <p className="stat-value mb-2">
                    {formatCurrency(unitPrice)}
                    {product.oldPrice && Number(product.oldPrice) > Number(displayPrice) && <span className="store-card-old">{formatCurrency(product.oldPrice)}</span>}
                  </p>
                  {isQuantity && tiers.length > 0 && (
                    <div className="qty-tier-table mb-2">
                      <span className="field-label">اختر الباقة</span>
                      <div className="qty-tier-list">
                         {tiers.map((t) => {
                            const sv = offerSavings(displayPrice, t.quantity, product?.pricingMode, product?.quantityTiers, product?.quantityPricingStrategy)
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

                  {(product.colors || []).length > 0 && (
                    <div className="mb-2">
                      <span className="field-label">اللون:</span>
                      <div className="flex flex-wrap mt-1">
                        {(product.colors || []).map((c) => (
                          <button key={c} type="button" className={`btn color-btn${color === c ? ' color-btn--active' : ''}`} onClick={() => { setColor(c); setQty(minQty) }}>
                            {c}
                          </button>
                        ))}
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
                            <button key={s} type="button" className={`btn size-btn${size === s ? ' size-btn--active' : ''}${disabled ? ' size-btn--disabled' : ''}`} disabled={disabled} onClick={() => { setSize(s); setQty(minQty) }}>
                              {s}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex mb-2">
                    <div className="qty-stepper">
                      <button type="button" className="qty-btn" onClick={() => stepQty(-1)}>−</button>
                      <strong>{qty}</strong>
                      <button type="button" className="qty-btn" onClick={() => stepQty(1)}>+</button>
                    </div>
                  </div>

                  <div className="flex flex-wrap">
                    <Button icon="shopping_cart" onClick={addToCart} disabled={!canAdd}>أضف إلى السلة</Button>
                    <Link href={`/store/${store?.slug}/cart`}><Button variant="outline">عرض السلة</Button></Link>
                    <Link href={`/store/${store?.slug}/product/${product.id}`}><Button variant="ghost" icon="open_in_new">صفحة المنتج</Button></Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <p className="muted small">© {new Date().getFullYear()} {store?.name || 'متجري'} — {store?.description || ''}</p>
          <Link href={`/store/${store?.slug}`} className="small">استعرض المتجر</Link>
        </div>
      </footer>
    </div>
  )
}
export default StoreLanding
