import { FunctionalComponent } from 'preact'
import { Link, useParams } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { useDocument } from '../../shared/hooks/useDocument'
import { Button } from '../../shared/components/ui/Button'
import { Badge } from '../../shared/components/ui/Badge'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { visibleOrderStatusLabel, visibleOrderStatusTone } from '../../shared/utils/order-status'
import { OrderTimeline } from '../../shared/components/order/OrderTimeline'
import { Icon } from '../../shared/components/ui/Icon'
import type { Order } from '../../shared/types'

interface Props {
  id: string
}

export const StoreOrderDetails: FunctionalComponent<Props> = ({ id }) => {
  const { store } = useStore()
  const { user } = useAuth()
  const params = useParams<{ id?: string }>()
  const orderId = params.id || id
  const { data: order, loading } = useDocument<Order>('orders', orderId)

  const ownsOrder = Boolean(order && store?.id && order.storeId === store.id && user?.role === 'customer' && order.customerId === user.uid)

  if (loading) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>

  if (!order || !ownsOrder) {
    return (
      <div className="storefront-page storefront-order-details storefront-order-details--stitch">
        <div className="auth-required">
          <Icon name="visibility_off" className="auth-icon" />
          <h1>الطلب غير موجود</h1>
          <p>هذا الطلب غير موجود أو لا تملك صلاحية الوصول إليه.</p>
          <Link href={`/store/${store?.slug}/account?tab=orders`}><Button icon="arrow_back">العودة لطلباتي</Button></Link>
        </div>
      </div>
    )
  }

  const statusTone = visibleOrderStatusTone(order)

  return (
    <div className="storefront-page storefront-order-details">
      <nav className="store-crumb" aria-label="خيط البيان">
        <Link href={`/store/${store?.slug}`}>الرئيسية</Link>
        <Icon name="chevron_left" ariaHidden />
        <Link href={`/store/${store?.slug}/account?tab=orders`}>طلباتي</Link>
        <Icon name="chevron_left" ariaHidden />
        <span>تفاصيل الطلب</span>
      </nav>

      <div className="order-details-grid">
        <section className="order-main">
          <div className="order-header-card">
            <div className="order-header-top">
              <div>
                <h1 className="order-number monospace">{order.orderNumber}</h1>
                <p className="order-date muted">{formatDateTime(order.createdAt)}</p>
              </div>
              <Badge tone={statusTone as any}>{visibleOrderStatusLabel(order)}</Badge>
            </div>
            <OrderTimeline order={order} />
          </div>

          <section className="order-items-section">
            <h2 className="section-title">المنتجات</h2>
            <div className="order-items">
              {order.items.map((item, idx) => (
                <article key={idx} className="order-item">
                  <div className="order-item-details">
                    <h3 className="order-item-name">{item.name}</h3>
                    <div className="order-item-meta">
                      {item.color && <span className="meta-tag"><Icon name="palette" ariaHidden /> {item.color}</span>}
                      {item.size && <span className="meta-tag"><Icon name="straighten" ariaHidden /> {item.size}</span>}
                      <span className="meta-tag"><Icon name="add_shopping_cart" ariaHidden /> ×{item.quantity}</span>
                    </div>
                  </div>
                  <div className="order-item-price">
                    <strong>{formatCurrency((item.unitPrice || item.price) * item.quantity)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className="order-sidebar">
          <section className="order-summary-card">
            <h2 className="section-title">ملخص الطلب</h2>
            <div className="summary-rows">
              <div className="summary-row"><span>المجموع الفرعي</span><span>{formatCurrency(order.subtotal)}</span></div>
              <div className="summary-row"><span>الشحن</span><span>{order.shippingFee > 0 ? formatCurrency(order.shippingFee) : 'مجاني'}</span></div>
              {order.discount > 0 && <div className="summary-row"><span>الخصم</span><span>-{formatCurrency(order.discount)}</span></div>}
              <div className="summary-row total"><span>الإجمالي</span><strong>{formatCurrency(order.totalPrice)}</strong></div>
            </div>
          </section>

          <section className="order-info-card">
            <h2 className="section-title">معلومات الطلب</h2>
            <dl className="order-info-list">
              <div className="info-row"><dt>طريقة الدفع</dt><dd>{order.paymentMethod === 'cod' ? 'الدفع عند الاستلام' : 'تحويل بنكي'}</dd></div>
              <div className="info-row"><dt>حالة الدفع</dt><dd>{order.paymentMethod === 'cod' ? 'عند الاستلام' : 'مكتمل'}</dd></div>
              <div className="info-row"><dt>نوع العميل</dt><dd>{order.customerType === 'guest' ? 'زائر' : 'مسجل'}</dd></div>
            </dl>
          </section>

          <section className="order-shipping-card">
            <h2 className="section-title">عنوان التوصيل</h2>
            <address className="shipping-address">
              <strong>{order.customerName}</strong><br />
              {order.address}<br />
              {order.city}, {order.governorate}<br />
              <a href={`tel:${order.phone}`} className="ltr-text">{order.phone}</a>
            </address>
          </section>

          {order.notes && (
            <section className="order-notes-card">
              <h2 className="section-title">ملاحظات العميل</h2>
              <p className="order-notes">{order.notes}</p>
            </section>
          )}

          <div className="order-actions">
            <Link href={`/store/${store?.slug}/account?tab=orders`}><Button variant="outline" block><Icon name="arrow_back" ariaHidden /> العودة لطلباتي</Button></Link>
            <Link href={`/store/${store?.slug}/track`}><Button variant="outline" block><Icon name="local_shipping" ariaHidden /> تتبع الشحنة</Button></Link>
            {order.status === 'DELIVERED' && (
              <Button block><Icon name="rate_review" ariaHidden /> تقييم الطلب</Button>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
export default StoreOrderDetails
