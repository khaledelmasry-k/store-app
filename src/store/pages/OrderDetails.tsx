import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { useDocument } from '../../shared/hooks/useDocument'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Table } from '../../shared/components/ui/Table'
import { OrderTimeline } from '../../shared/components/order/OrderTimeline'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import type { Order } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'

interface Props {
  id: string
}

export const StoreOrderDetails: FunctionalComponent<Props> = ({ id }) => {
  const { store } = useStore()
  const { user } = useAuth()
  const { data: order, loading } = useDocument<Order>('orders', id)

  if (loading) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>
  if (!order) {
    return (
      <div className="order-confirmed">
        <div className="big-check"><Icon name="error" /></div>
        <h1 className="auth-title">الطلب غير متاح</h1>
        <p className="auth-subtitle">لم نتمكن من عرض هذا الطلب. تأكد من أنه يخص حسابك.</p>
        <Link href={`/store/${store?.slug}/account`}><Button>الرجوع إلى حسابي</Button></Link>
      </div>
    )
  }

  // Only the registered owner of this order may view it (rules enforce it too).
  const mine = user?.role === 'customer' && (order.customerId === user?.uid || order.phone === user?.phone)
  if (!mine) {
    return (
      <div className="order-confirmed">
        <div className="big-check"><Icon name="lock" /></div>
        <h1 className="auth-title">الطلب غير متاح</h1>
        <p className="auth-subtitle">هذا الطلب لا يخص حسابك الحالي.</p>
        <Link href={`/store/${store?.slug}/account`}><Button>الرجوع إلى حسابي</Button></Link>
      </div>
    )
  }

  const statusTone = STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || 'slate'

  return (
    <div>
      <div className="flex-between mb-2">
        <h1 className="page-title">
          <span className="monospace">{order.orderNumber}</span>
        </h1>
        <Badge tone={statusTone}>{STATUS_LABELS[order.status] || order.status}</Badge>
      </div>
      <p className="page-subtitle">تم الطلب في {formatDateTime(order.createdAt)}</p>

      <Card title="تتبع حالة الطلب" className="mb-2">
        <OrderTimeline order={order} />
      </Card>

      <div className="grid grid-2 mb-2">
        <Card title="المنتجات">
          <Table cardMode
            columns={[
              { key: 'name', header: 'المنتج' },
              { key: 'options', header: 'الخيارات', render: (item: any) => <span className="muted">{[item.color, item.size].filter(Boolean).join(' • ') || '—'}</span> },
              { key: 'quantity', header: 'الكمية' },
              { key: 'price', header: 'السعر', render: (item: any) => item.pricingMode === 'quantity' && item.quantityTier ? `${item.quantity} قطع — ${formatCurrency(item.quantityTier.price)}` : formatCurrency(item.price) },
              { key: 'total', header: 'الإجمالي', render: (item: any) => formatCurrency(item.lineTotal != null ? item.lineTotal : item.price * item.quantity) },
            ]}
            rows={order.items as any}
          />
        </Card>
        <Card title="ملخص الطلب">
          <dl className="kv">
            <div className="kv-item"><dt>رقم الطلب</dt><dd className="monospace">{order.orderNumber}</dd></div>
            <div className="kv-item"><dt>التاريخ</dt><dd>{formatDateTime(order.createdAt)}</dd></div>
            <div className="kv-item"><dt>المجموع الفرعي</dt><dd>{formatCurrency(order.subtotal)}</dd></div>
            <div className="kv-item"><dt>الشحن</dt><dd>{order.shippingFee > 0 ? formatCurrency(order.shippingFee) : 'مجاني'}</dd></div>
            {order.discount > 0 && <div className="kv-item"><dt>الخصم</dt><dd>-{formatCurrency(order.discount)}</dd></div>}
            <div className="kv-item"><dt>الإجمالي</dt><dd>{formatCurrency(order.totalPrice)}</dd></div>
            <div className="kv-item"><dt>طريقة الدفع</dt><dd>{order.paymentMethod === 'cod' ? 'عند الاستلام' : order.paymentMethod === 'bank' ? 'تحويل بنكي' : order.paymentMethod}</dd></div>
            <div className="kv-item"><dt>الحالة الحالية</dt><dd><Badge tone={statusTone}>{STATUS_LABELS[order.status] || order.status}</Badge></dd></div>
          </dl>
        </Card>
      </div>

      <div className="flex">
        <Link href={`/store/${store?.slug}/track`}><Button variant="outline" icon="receipt_long">تتبع الطلب</Button></Link>
        <Link href={`/store/${store?.slug}/account`}><Button variant="ghost" icon="arrow_forward">الرجوع لحسابي</Button></Link>
      </div>
    </div>
  )
}
export default StoreOrderDetails