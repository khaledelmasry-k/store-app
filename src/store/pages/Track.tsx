import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { useStore } from '../../shared/hooks/useStore'
import { Input } from '../../shared/components/ui/Input'
import { Button } from '../../shared/components/ui/Button'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { trackOrderCallable } from '../../shared/services/auth'
import { OrderTimeline } from '../../shared/components/order/OrderTimeline'
import { Icon } from '../../shared/components/ui/Icon'

interface TrackedItem {
  name: string
  quantity: number
  color?: string
  size?: string
}

interface TrackedOrder {
  id: string
  orderNumber: string
  status: string
  statusHistory?: { status: string; at: { seconds: number; nanoseconds: number } }[] | null
  items: TrackedItem[]
  subtotal: number
  shippingFee: number
  shippingMethod?: string | null
  shippingProviderName?: string | null
  totalPrice: number
  paymentMethod: string
  customerType?: string
  createdAt: { seconds: number; nanoseconds: number }
  shipment?: { providerName?: string | null; status?: string | null; trackingNumber?: string | null; trackingUrl?: string | null; failureReason?: string | null; updatedAt?: { seconds: number; nanoseconds: number } | null } | null
}

export const StoreTrack: FunctionalComponent = () => {
  const { store } = useStore()
  const [phone, setPhone] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [orders, setOrders] = useState<TrackedOrder[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async (e: Event) => {
    e.preventDefault()
    if (!phone.trim() || !orderNumber.trim()) {
      setError('أدخل رقم الهاتف ورقم الطلب معاً')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await trackOrderCallable({
        storeId: store?.id,
        phone: phone.trim(),
        orderNumber: orderNumber.trim(),
      })
      setOrders((res.data as any)?.orders || [])
      if (!(res.data as any)?.orders?.length) setError('لا توجد طلبات مطابقة لهذه البيانات.')
    } catch (err: any) {
      setOrders([])
      setError(err?.message || 'تعذر البحث عن الطلب')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="storefront-page storefront-track storefront-track--stitch">
      <header className="track-hero">
        <span className="page-eyebrow">خدمة ما بعد البيع</span>
        <h1 className="page-title">تتبع طلبك</h1>
        <p className="page-subtitle">أدخل كود الطلب ورقم الهاتف كما كُتبا عند إتمام الشراء</p>
      </header>

      <form onSubmit={search} className="track-form">
        <div className="form-grid">
          <Input label="رقم الهاتف" value={phone} onChange={setPhone} placeholder="01xxxxxxxxx" required type="tel" />
          <Input label="كود الطلب" value={orderNumber} onChange={setOrderNumber} placeholder="ORD-00001" required />
        </div>
        <Button type="submit" loading={loading} icon="search" className="mt-1" block>تتبع الطلب</Button>
      </form>

      {error && <div className="track-error" role="alert"><Icon name="error" /> {error}</div>}

      {orders && orders.length > 0 && (
        <div className="track-results">
          {orders.map((o) => (
            <article key={o.id} className="track-order-card">
              <div className="track-order-header">
                <div>
                  <p className="track-order-number monospace">{o.orderNumber}</p>
                  <p className="track-order-date muted small">{formatDateTime(o.createdAt)}</p>
                </div>
                <span className={`status-badge status-${String(o.shipment?.status || '').toUpperCase() === 'FAILED' ? 'red' : STATUS_COLORS[o.status as keyof typeof STATUS_COLORS]}`}>
                  {String(o.shipment?.status || '').toUpperCase() === 'FAILED' ? 'تعذر التسليم' : (STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] || o.status)}
                </span>
              </div>

              <section className="track-timeline-section">
                <h3 className="section-title">حالة الشحنة</h3>
                <OrderTimeline order={{ status: o.status as any, statusHistory: o.statusHistory as any }} />
              </section>

              {o.shipment && <section className="track-details-section">
                <h3 className="section-title">تفاصيل الشحنة</h3>
                <div className="detail-grid">
                  {o.shipment.providerName && <div className="detail-item"><Icon name="local_shipping" className="detail-icon" /><div><span className="detail-label">شركة الشحن</span><span className="detail-value">{o.shipment.providerName}</span></div></div>}
                  {o.shipment.trackingNumber && <div className="detail-item"><Icon name="pin" className="detail-icon" /><div><span className="detail-label">كود المتابعة</span><span className="detail-value">{o.shipment.trackingUrl ? <a href={o.shipment.trackingUrl} target="_blank" rel="noreferrer">{o.shipment.trackingNumber}</a> : o.shipment.trackingNumber}</span></div></div>}
                  {o.shipment.failureReason && <div className="detail-item"><Icon name="info" className="detail-icon" /><div><span className="detail-label">ملاحظة من شركة الشحن</span><span className="detail-value">{o.shipment.failureReason}</span></div></div>}
                </div>
              </section>}

              <section className="track-items-section">
                <h3 className="section-title">المنتجات</h3>
                <div className="track-items">
                  {o.items.map((item, idx) => (
                    <div key={idx} className="track-item">
                      <div className="track-item-info">
                        <strong>{item.name}</strong>
                        <span className="muted small">الكمية: {item.quantity} {item.color && `• ${item.color}`} {item.size && `• ${item.size}`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="track-summary-section">
                <h3 className="section-title">ملخص الطلب</h3>
                <div className="summary-rows">
                  <div className="summary-row"><span>المجموع الفرعي</span><span>{formatCurrency(o.subtotal)}</span></div>
                  <div className="summary-row"><span>الشحن{o.shippingMethod ? ` (${o.shippingMethod})` : ''}</span><span>{o.shippingFee > 0 ? formatCurrency(o.shippingFee) : 'مجاني'}</span></div>
                  <div className="summary-row total"><span>الإجمالي</span><span>{formatCurrency(o.totalPrice)}</span></div>
                </div>
              </section>

              <section className="track-details-section">
                <h3 className="section-title">معلومات التوصيل والدفع</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <Icon name="location_on" className="detail-icon" />
                    <div>
                      <span className="detail-label">عنوان التوصيل</span>
                      <span className="detail-value">تم حفظ العنوان بأمان مع الطلب</span>
                    </div>
                  </div>
                  <div className="detail-item">
                    <Icon name="payments" className="detail-icon" />
                    <div>
                      <span className="detail-label">طريقة الدفع</span>
                      <span className="detail-value">{o.paymentMethod === 'cod' ? 'الدفع عند الاستلام' : 'تحويل بنكي'}</span>
                    </div>
                  </div>
                </div>
              </section>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
export default StoreTrack
