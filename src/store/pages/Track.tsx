import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { useStore } from '../../shared/hooks/useStore'
import { Input } from '../../shared/components/ui/Input'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { formatCurrency } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { trackOrderCallable } from '../../shared/services/auth'

interface TrackedOrder {
  id: string
  orderNumber: string
  status: string
  items: { name: string; quantity: number }[]
  totalPrice: number
  paymentMethod: string
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
    if (!phone.trim()) {
      setError('أدخل رقم الهاتف')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await trackOrderCallable({
        storeId: store?.id,
        phone: phone.trim(),
        orderNumber: orderNumber.trim() || undefined,
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
      <h1 className="page-title mb-2">تتبع طلبك</h1>
      <Card className="mb-2">
        <form onSubmit={search}>
          <div className="grid grid-2">
            <Input label="رقم الهاتف" value={phone} onChange={setPhone} placeholder="01xxxxxxxxx" required />
            <Input label="رقم الطلب (اختياري)" value={orderNumber} onChange={setOrderNumber} placeholder="ORD-00001" />
          </div>
          <Button type="submit" loading={loading} icon="search" className="mt-1">تتبع الطلب</Button>
        </form>
      </Card>
      {error && <p className="muted">{error}</p>}
      <div>
        {orders?.map((o) => (
          <Card key={o.id} className="mb-2">
            <div className="flex-between mb-1">
              <strong className="monospace">{o.orderNumber}</strong>
              <Badge tone={STATUS_COLORS[o.status as keyof typeof STATUS_COLORS]}>{STATUS_LABELS[o.status as keyof typeof STATUS_LABELS]}</Badge>
            </div>
            <div className="summary-row"><span>المنتجات</span><span>{o.items.map((i) => `${i.name} ×${i.quantity}`).join('، ')}</span></div>
            <div className="summary-row total"><span>الإجمالي</span><span>{formatCurrency(o.totalPrice)}</span></div>
            <p className="muted small mt-1">طريقة الدفع: {o.paymentMethod}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
export default StoreTrack
