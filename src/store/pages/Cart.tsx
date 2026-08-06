import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { useCart } from '../../shared/hooks/useCart'
import { useStore } from '../../shared/hooks/useStore'
import { Button } from '../../shared/components/ui/Button'
import { Card } from '../../shared/components/ui/Card'
import { formatCurrency } from '../../shared/utils/format'

export const StoreCart: FunctionalComponent = () => {
  const cart = useCart()
  const { store } = useStore()

  if (cart.items.length === 0) {
    return (
      <div className="order-confirmed">
        <div className="big-check"><span className="material-symbols-outlined">shopping_cart</span></div>
        <h1 className="auth-title">سلتك فارغة</h1>
        <p className="auth-subtitle">أضف بعض المنتجات وعد إلى هنا لإتمام الطلب.</p>
        <Link href={`/store/${store?.slug}/catalog`}><Button variant="outline">تصفح المنتجات</Button></Link>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">سلة التسوق</h1>
        <p className="page-subtitle">{cart.count} منتج</p>
      </div>

      <div className="cart-layout">
        <div>
          {cart.items.map((item, i) => (
            <Card key={i} className="cart-line">
              <div className="flex flex-gap-lg">
                {item.image && <img src={item.image} alt={item.name} className="cart-line-img" />}
                <div className="grow">
                  <p><strong>{item.name}</strong></p>
                  <p className="muted small">
                    {[item.color, item.size].filter(Boolean).join(' • ')} • {formatCurrency(item.price)}
                  </p>
                </div>
                <div className="qty-stepper">
                  <button type="button" className="qty-btn" onClick={() => cart.setQty(i, Math.max(1, item.quantity - 1))}>−</button>
                  <strong>{item.quantity}</strong>
                  <button type="button" className="qty-btn" onClick={() => cart.setQty(i, item.quantity + 1)}>+</button>
                </div>
                <strong>{formatCurrency(item.price * item.quantity)}</strong>
                <button className="icon-btn" onClick={() => cart.remove(i)} type="button">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </Card>
          ))}
        </div>
        <div className="order-summary">
          <h3 className="card-title mb-1">ملخص الطلب</h3>
          <div className="summary-row"><span>المنتجات</span><span>{cart.count}</span></div>
          <div className="summary-row"><span>المجموع الفرعي</span><span>{formatCurrency(cart.subtotal)}</span></div>
          <div className="summary-row total"><span>الإجمالي</span><span>{formatCurrency(cart.subtotal)}</span></div>
          <Link href={`/store/${store?.slug}/checkout`}><Button block icon="checkout" className="mt-1">إتمام الطلب</Button></Link>
        </div>
      </div>
    </div>
  )
}
export default StoreCart