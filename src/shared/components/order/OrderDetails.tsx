import { FunctionalComponent, Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { useDocument } from '../../hooks/useDocument'
import { useToast } from '../../hooks/useToast'
import { updateOrderStatusCallable } from '../../services/auth'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { ORDER_STATUSES, STATUS_LABELS, STATUS_COLORS } from '../../utils/constants'
import type { Order } from '../../types'

interface Props {
  id: string
}

export const OrderDetails: FunctionalComponent<Props> = ({ id }) => {
  const { data: order, loading } = useDocument<Order>('orders', id)
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  if (loading) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>
  if (!order) return <Card title="الطلب غير موجود" />

  const changeStatus = async () => {
    if (!status || status === order.status) return
    setSaving(true)
    try {
      await updateOrderStatusCallable({ orderId: order.id, status })
      toast.push('تم تحديث حالة الطلب')
      setStatus('')
    } catch {
      toast.push('تعذر تحديث الحالة', undefined, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Fragment>
      <div className="flex-between mb-2">
        <h1 className="page-title"><span className="monospace">{order.orderNumber}</span></h1>
        <Badge tone={STATUS_COLORS[order.status]}>{STATUS_LABELS[order.status]}</Badge>
      </div>
      <div className="grid grid-2">
        <Card title="معلومات العميل">
          <dl className="kv">
            <div className="kv-item"><dt>الاسم</dt><dd>{order.customerName}</dd></div>
            <div className="kv-item"><dt>الهاتف</dt><dd>{order.phone}</dd></div>
            <div className="kv-item"><dt>المحافظة</dt><dd>{order.governorate}</dd></div>
            <div className="kv-item"><dt>المدينة</dt><dd>{order.city}</dd></div>
            <div className="kv-item"><dt>العنوان</dt><dd>{order.address}</dd></div>
            {order.notes && <div className="kv-item"><dt>ملاحظات</dt><dd>{order.notes}</dd></div>}
          </dl>
        </Card>
        <Card title="ملخص الطلب">
          <dl className="kv">
            <div className="kv-item"><dt>المجموع الفرعي</dt><dd>{formatCurrency(order.subtotal)}</dd></div>
            <div className="kv-item"><dt>الشحن</dt><dd>{formatCurrency(order.shippingFee)}</dd></div>
            {order.discount > 0 && <div className="kv-item"><dt>الخصم</dt><dd>-{formatCurrency(order.discount)}</dd></div>}
            <div className="kv-item"><dt>الإجمالي</dt><dd>{formatCurrency(order.totalPrice)}</dd></div>
            <div className="kv-item"><dt>طريقة الدفع</dt><dd>{order.paymentMethod}</dd></div>
            <div className="kv-item"><dt>التاريخ</dt><dd>{formatDateTime(order.createdAt)}</dd></div>
          </dl>
        </Card>
      </div>
      <Card title="المنتجات" className="mt-2 mb-2">
        <table className="table">
          <thead><tr><th>المنتج</th><th>الخيارات</th><th>الكمية</th><th>السعر</th></tr></thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td className="muted">{[item.color, item.size].filter(Boolean).join(' • ')}</td>
                <td>{item.quantity}</td>
                <td>{formatCurrency(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="تغيير الحالة">
        <div className="flex">
          <Select
            value={status}
            onChange={setStatus}
            placeholder="اختر الحالة الجديدة"
            options={ORDER_STATUSES.filter((s) => s !== order.status).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
          <Button onClick={changeStatus} loading={saving} disabled={!status}>تحديث</Button>
        </div>
      </Card>
    </Fragment>
  )
}
