import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { useCart } from '../../shared/hooks/useCart'
import { useStore } from '../../shared/hooks/useStore'
import { Button } from '../../shared/components/ui/Button'
import { Card } from '../../shared/components/ui/Card'
import { SmartImage } from '../../shared/components/ui/SmartImage'
import { formatCurrency } from '../../shared/utils/format'
import { lineSubtotal, nextTierQuantity, piecesLabel } from '../../shared/utils/pricing'
import { Icon } from '../../shared/components/ui/Icon'

export const StoreCart: FunctionalComponent = () => {
  const cart = useCart()
  const { store } = useStore()

  if (cart.items.length === 0) {
    return (
      <div className="order-confirmed storefront-state storefront-empty-cart">
        <div className="big-check"><Icon name="shopping_cart" /></div>
        <h1 className="auth-title">سلتك فارغة</h1>
        <p className="auth-subtitle">أضف بعض المنتجات وعد إلى هنا لإتمام الطلب.</p>
        <Link href={`/store/${store?.slug}/catalog`}><Button variant="outline">تصفح المنتجات</Button></Link>
      </div>
    )
  }

  return (
    <div className="storefront-page storefront-cart">
      <div className="page-header storefront-page-head">
        <h1 className="page-title">سلة التسوق</h1>
        <p className="page-subtitle">{cart.count} منتج</p>
      </div>

      <div className="cart-layout checkout-workspace">
        <div>
          {cart.items.map((item, i) => {
            const isQtyMode = item.pricingMode === 'quantity' && item.quantityTiers && item.quantityTiers.length > 0
            const step = (dir: -1 | 1) => {
              if (isQtyMode) {
                const next = nextTierQuantity(item.quantityTiers, item.quantity, dir)
                // Bundle tiers can legitimately exceed stock; clamp only when a
                // ceiling snapshot exists and the tier would oversell.
                if (next != null && (item.maxQty == null || next <= item.maxQty)) cart.setQty(i, next)
              } else {
                const maxQty = item.maxQty == null || item.maxQty < 1 ? undefined : item.maxQty
                const next = dir === 1 && maxQty != null ? Math.min(item.quantity + 1, maxQty) : item.quantity + dir
                cart.setQty(i, Math.max(1, next))
              }
            }
            return (
              <Card key={i} className="cart-line">
                <div className="flex flex-gap-lg">
                  {item.image && <SmartImage src={item.image} alt={item.name} className="cart-line-img" placeholderClassName="cart-line-img" />}
                  <div className="grow">
                    <p><strong>{item.name}</strong></p>
                    <p className="muted small">
                      {[item.color, item.size].filter(Boolean).join(' • ')}
                      {isQtyMode ? ` • ${item.quantity} ${piecesLabel(item.quantity)}` : ` • ${formatCurrency(item.price)}`}
                    </p>
                  </div>
                  <div className="qty-stepper">
                    <button type="button" className="qty-btn" onClick={() => step(-1)}>−</button>
                    <strong>{item.quantity}</strong>
                    <button type="button" className="qty-btn" onClick={() => step(1)}>+</button>
                  </div>
                  <strong>{formatCurrency(lineSubtotal(item))}</strong>
                  <button className="icon-btn" onClick={() => cart.remove(i)} type="button">
                    <Icon name="delete" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
        <div className="order-summary">
          <h3 className="card-title mb-1">ملخص الطلب</h3>
          <div className="summary-row"><span>المنتجات</span><span>{cart.count}</span></div>
          <div className="summary-row"><span>المجموع الفرعي</span><span>{formatCurrency(cart.subtotal)}</span></div>
          <div className="summary-row total"><span>الإجمالي</span><span>{formatCurrency(cart.subtotal)}</span></div>
          <Link href={`/store/${store?.slug}/checkout`}><Button block icon="shopping_cart_checkout" className="mt-1">إتمام الطلب</Button></Link>
        </div>
      </div>
    </div>
  )
}
export default StoreCart
