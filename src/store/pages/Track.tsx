import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { useStore } from '../../shared/hooks/useStore'
import { Input } from '../../shared/components/ui/Input'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { trackOrderCallable } from '../../shared/services/auth'
import { OrderTimeline } from '../../shared/components/order/OrderTimeline'

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
  totalPrice: number
  paymentMethod: string
  customerType?: string
  createdAt: { seconds: number; nanoseconds: number }
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
    <div>
      <div className="page-header">
        <h1 className="page-title">تتبع طلبك</h1>
        <p className="page-subtitle">أدخل رقم الطلب ورقم الهاتف للبحث عن طلبك</p>
      </div>

      <Card className="mb-2">
        <form onSubmit={search}>
          <div className="grid grid-2">
            <Input label="رقم الهاتف" value={phone} onChange={setPhone} placeholder="01xxxxxxxxx" required />
            <Input label="رقم الطلب" value={orderNumber} onChange={setOrderNumber} placeholder="ORD-00001" required />
          </div>
          <Button type="submit" loading={loading} icon="search" className="mt-1">تتبع الطلب</Button>
        </form>
      </Card>

      {error && <p className="muted">{error}</p>}

      <div>
        {orders?.map((o) => (
          <Card key={o.id} className="mb-2">
            <div className="flex-between mb-1">
              <div>
                <strong className="monospace">{o.orderNumber}</strong>
                <p className="muted small">{formatDateTime(o.createdAt)}</p>
              </div>
              <Badge tone={STATUS_COLORS[o.status as keyof typeof STATUS_COLORS]}>{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS]}</Badge>
            </div>

            <Card title="تتبع حالة الطلب" className="mb-2">
              <OrderTimeline order={{ status: o.status as any, statusHistory: o.statusHistory as any }} />
            </Card>

            <div className="mb-2">
              {o.items.map((i, idx) => (
                <div key={idx} className="summary-row">
                  <span>
                    {i.name} ×{i.quantity}
                    {(i.color || i.size) && <span className="muted small"> ({[i.color, i.size].filter(Boolean).join(' • ')})</span>}
                  </span>
                </div>
              ))}
            </div>
            <div className="summary-row"><span>الإجمالي الفرعي</span><span>{formatCurrency(o.subtotal)}</span></div>
            <div className="summary-row"><span>الشحن</span><span>{o.shippingFee > 0 ? formatCurrency(o.shippingFee) : 'مجاني'}</span></div>
            <div className="summary-row total"><span>الإجمالي</span><span>{formatCurrency(o.totalPrice)}</span></div>
            <p className="muted small mt-1">طريقة الدفع: {o.paymentMethod === 'cod' ? 'عند الاستلام' : 'تحويل بنكي'}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
export default StoreTrack