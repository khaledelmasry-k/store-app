import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { useCart } from '../../shared/hooks/useCart'
import { useStore } from '../../shared/hooks/useStore'
import { Button } from '../../shared/components/ui/Button'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { formatCurrency } from '../../shared/utils/format'
import { lineSubtotal, nextTierQuantity, piecesLabel } from '../../shared/utils/pricing'
import { Icon } from '../../shared/components/ui/Icon'

export const StoreCart: FunctionalComponent = () => {
  const cart = useCart()
  const { store } = useStore()

  if (cart.items.length === 0) {
    return (
      <div className="storefront-page storefront-cart storefront-empty-cart">
        <div className="store-empty-state">
          <Icon name="shopping_cart" className="store-empty-icon" />
          <h1>سلتك فارغة</h1>
          <p>أضف بعض المنتجات وعد إلى هنا لإتمام الطلب.</p>
          <Link href={`/store/${store?.slug}/catalog`}><Button variant="outline">تصفح المنتجات</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="storefront-page storefront-cart storefront-cart--stitch">
      <header className="cart-hero">
        <div>
          <span className="page-eyebrow">خطوتك التالية</span>
          <h1 className="page-title">سلة التسوق</h1>
          <p className="page-subtitle">راجع اختياراتك قبل إتمام الطلب</p>
        </div>
        <div className="cart-count-badge"><strong>{cart.count}</strong><span>منتج</span></div>
      </header>
      <div className="cart-stepper" aria-label="خطوات الشراء">
        <span className="active"><b>1</b> السلة</span><i /> <span><b>2</b> العنوان</span><i /> <span><b>3</b> التأكيد</span>
      </div>

      <div className="cart-layout">
        <div className="cart-lines">
          {cart.items.map((item, i) => {
            const isQtyMode = item.pricingMode === 'quantity' && item.quantityTiers && item.quantityTiers.length > 0
            const step = (dir: -1 | 1) => {
              if (isQtyMode) {
                const next = nextTierQuantity(item.quantityTiers, item.quantity, dir)
                if (next != null && (item.maxQty == null || next <= item.maxQty)) cart.setQty(i, next)
              } else {
                const maxQty = item.maxQty == null || item.maxQty < 1 ? undefined : item.maxQty
                const next = dir === 1 && maxQty != null ? Math.min(item.quantity + 1, maxQty) : item.quantity + dir
                cart.setQty(i, Math.max(1, next))
              }
            }
            return (
              <article key={i} className="cart-line">
                <Link href={`/store/${store?.slug}/product/${item.productId}`} className="cart-line-image">
                  <SmartImage src={item.image} alt={item.name} className="cart-line-img" placeholderClassName="cart-line-img" fallback="product" />
                </Link>
                <div className="cart-line-details">
                  <Link href={`/store/${store?.slug}/product/${item.productId}`} className="cart-line-name">
                    <strong>{item.name}</strong>
                  </Link>
                  <p className="cart-line-meta muted small">
                    {[item.color, item.size].filter(Boolean).join(' • ')}
                    {isQtyMode ? ` • ${item.quantity} ${piecesLabel(item.quantity)}` : ` • ${formatCurrency(item.price)}`}
                  </p>
                </div>
                <div className="qty-stepper cart-line-qty">
                  <button type="button" className="qty-btn" onClick={() => step(-1)} aria-label="تقليل الكمية">−</button>
                  <span className="qty-value">{item.quantity}</span>
                  <button type="button" className="qty-btn" onClick={() => step(1)} aria-label="زيادة الكمية">+</button>
                </div>
                <div className="cart-line-price">
                  <strong>{formatCurrency(lineSubtotal(item))}</strong>
                </div>
                <button className="icon-btn cart-line-remove" onClick={() => cart.remove(i)} type="button" aria-label="إزالة من السلة">
                  <Icon name="delete" />
                </button>
              </article>
            )
          })}
        </div>
        <aside className="order-summary" id="cart-summary">
          <h2 className="summary-title">ملخص الطلب</h2>
          <div className="summary-row"><span>المنتجات</span><span>{cart.count}</span></div>
          <div className="summary-row"><span>المجموع الفرعي</span><span>{formatCurrency(cart.subtotal)}</span></div>
          <div className="summary-row"><span>الشحن</span><span>يتم حسابه عند الدفع</span></div>
          <div className="summary-row total"><span>الإجمالي</span><span>{formatCurrency(cart.subtotal)}</span></div>
          <Link href={`/store/${store?.slug}/checkout`}><Button block icon="shopping_cart_check" className="mt-1">إتمام الطلب</Button></Link>
          <Link href={`/store/${store?.slug}/catalog`} className="btn btn-outline btn-block mt-1">متابعة التسوق</Link>
        </aside>
      </div>
    </div>
  )
}
export default StoreCart
