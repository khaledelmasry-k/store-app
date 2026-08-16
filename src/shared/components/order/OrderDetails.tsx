import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Table } from '../ui/Table'
import { useDocument } from '../../hooks/useDocument'
import { useCollection } from '../../hooks/useCollection'
import { useToast } from '../../hooks/useToast'
import { updateOrderStatusCallable } from '../../services/auth'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { ORDER_STATUSES, STATUS_LABELS, STATUS_COLORS } from '../../utils/constants'
import { orderItemRevenue } from '../../utils/pricing'
import type { Order, OrderCost, ProductCost } from '../../types'
import { Icon } from '../ui/Icon'
import '../../../merchant/components/InternalWorkspace.css'

interface Props {
  id: string
}

const PROGRESS: Order['status'][] = ['NEW', 'CONTACTED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
const TERMINAL: Order['status'][] = ['CANCELLED', 'RETURNED']

export const OrderDetails: FunctionalComponent<Props> = ({ id }) => {
  const { data: order, loading } = useDocument<Order>('orders', id)
  const { data: orderCost } = useDocument<OrderCost>('orderCosts', order?.id || null)
  const costsRes = useCollection<ProductCost>('productCosts', { storeId: order?.storeId || '__none__' }, !!order?.storeId)
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  if (loading) return <div className="loading-screen"><span className="spinner spinner-lg" /></div>
  if (!order) return <Card title="الطلب غير موجود" />

  // Gross profit: prefer the immutable private orderCosts snapshot. Fall back
  // to current productCosts only for legacy orders created before snapshots.
  const costByLine = new Map((orderCost?.items || []).map((c) => [c.lineId, c.costPrice]))
  const costByProduct = new Map(costsRes.data.map((c) => [c.id, c.costPrice]))
  let grossRevenue = 0
  let cogs = 0
  let costedLines = 0
  for (const it of order.items) {
    const cost = costByLine.has(it.id) ? costByLine.get(it.id) : costByProduct.get(it.productId)
    if (typeof cost !== 'number' || cost < 0) continue
    grossRevenue += orderItemRevenue(it)
    cogs += Math.max(1, it.quantity || 1) * cost
    costedLines += 1
  }
  const hasCosts = costedLines > 0
  const grossProfit = grossRevenue - cogs

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

  const stepIndex = PROGRESS.indexOf(order.status)
  const isTerminal = TERMINAL.includes(order.status)
  const statusTone = isTerminal ? 'red' : (STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || 'slate')
  const statusLabel = STATUS_LABELS[order.status as keyof typeof STATUS_LABELS] || order.status

  return (
    <div className="order-detail-workspace">
      <section className="workspace-section card order-detail-status-section">
        <div className="workspace-section-body order-detail-status-body">
          <div className="flex-between">
            <div>
              <span className="eyebrow">معرّف الطلب</span>
              <h1 className="page-title"><span className="monospace">{order.orderNumber}</span></h1>
            </div>
            <Badge tone={statusTone}>{statusLabel}</Badge>
          </div>
        </div>
      </section>

      <Card className="order-timeline-card">
        <div className="order-steps">
          {PROGRESS.map((s, i) => {
            const done = stepIndex >= 0 && i <= stepIndex
            const active = i === stepIndex
            return (
              <div key={s} className={`order-step${done ? ' order-step--done' : ''}${active ? ' order-step--active' : ''}`}>
                <span className="order-step-dot">
                  {done && !active ? <Icon name="check" /> : i + 1}
                </span>
                <span className="order-step-label">{STATUS_LABELS[s] || s}</span>
                {i < PROGRESS.length - 1 && <span className="order-step-line" />}
              </div>
            )
          })}
        </div>
        {isTerminal && (
          <div className="order-step-terminal">
            <Badge tone="red">{STATUS_LABELS[order.status]}</Badge>
            <span className="muted small">هذا الطلب في حالة نهائية ولا يمكن متابعة تنفيذه.</span>
          </div>
        )}
      </Card>

      <div className="order-detail-summary-grid">
        <section className="workspace-section"><div className="workspace-section-head"><div><h2>معلومات العميل</h2><p>بيانات الشحن والتواصل المرتبطة بالطلب</p></div></div><div className="workspace-section-body">
          <dl className="kv">
            <div className="kv-item"><dt>الاسم</dt><dd>{order.customerName}</dd></div>
            <div className="kv-item"><dt>الهاتف</dt><dd>{order.phone}</dd></div>
            <div className="kv-item"><dt>المحافظة</dt><dd>{order.governorate}</dd></div>
            <div className="kv-item"><dt>المدينة</dt><dd>{order.city}</dd></div>
            <div className="kv-item"><dt>العنوان</dt><dd>{order.address}</dd></div>
            {order.notes && <div className="kv-item"><dt>ملاحظات</dt><dd>{order.notes}</dd></div>}
          </dl>
        </div></section>
        <section className="workspace-section"><div className="workspace-section-head"><div><h2>ملخص الطلب</h2><p>القيمة، الدفع والتاريخ</p></div></div><div className="workspace-section-body">
          <dl className="kv">
            <div className="kv-item"><dt>المجموع الفرعي</dt><dd>{formatCurrency(order.subtotal)}</dd></div>
            <div className="kv-item"><dt>الشحن</dt><dd>{formatCurrency(order.shippingFee)}</dd></div>
            {order.discount > 0 && <div className="kv-item"><dt>الخصم</dt><dd>-{formatCurrency(order.discount)}</dd></div>}
            <div className="kv-item"><dt>الإجمالي</dt><dd>{formatCurrency(order.totalPrice)}</dd></div>
            <div className="kv-item"><dt>طريقة الدفع</dt><dd>{order.paymentMethod === 'cod' ? 'عند الاستلام' : order.paymentMethod === 'bank' ? 'تحويل بنكي' : order.paymentMethod}</dd></div>
            <div className="kv-item"><dt>التاريخ</dt><dd>{formatDateTime(order.createdAt)}</dd></div>
          </dl>
        </div></section>
      </div>

      <section className="workspace-section"><div className="workspace-section-head"><div><h2>المنتجات</h2><p>{order.items.length} منتج مع الخيارات والكميات والأسعار</p></div></div><div className="workspace-section-body">
        <Table
          columns={[
            { key: 'name', header: 'المنتج' },
            { key: 'options', header: 'الخيارات', render: (item: any) => <span className="muted">{[item.color, item.size].filter(Boolean).join(' • ')}</span> },
            { key: 'quantity', header: 'الكمية' },
            { key: 'price', header: 'السعر', render: (item: any) => item.pricingMode === 'quantity' && item.quantityTier ? `${item.quantity} قطع — ${formatCurrency(item.quantityTier.price)}` : formatCurrency(item.price) },
            { key: 'total', header: 'الإجمالي', render: (item: any) => formatCurrency(item.lineTotal != null ? item.lineTotal : item.price * item.quantity) },
          ]}
          rows={order.items as any}
        />
      </div></section>

      <section className="workspace-section"><div className="workspace-section-head"><div><h2>الربح الإجمالي</h2><p>إيرادات الطلب مطروحاً منها تكلفة البضاعة المباعة</p></div></div><div className="workspace-section-body">
        {hasCosts ? (
          <div className="kv">
            <div className="kv-item"><dt>إيرادات الطلب</dt><dd>{formatCurrency(grossRevenue)}</dd></div>
            <div className="kv-item"><dt>تكلفة البضاعة (COGS)</dt><dd>{formatCurrency(cogs)}</dd></div>
            <div className="kv-item"><dt>الربح الإجمالي</dt><dd className={grossProfit < 0 ? 'text-red font-semibold' : 'font-semibold'}>{formatCurrency(grossProfit)}</dd></div>
          </div>
        ) : (
          <p className="muted small m-0">أضف أسعار التكلفة للمنتجات لعرض الأرباح.</p>
        )}
      </div></section>

      <section className="workspace-section"><div className="workspace-section-head"><div><h2>تغيير الحالة</h2><p>تحديث حالة الطلب وفق دورة العمل الحالية</p></div></div><div className="workspace-section-body order-status-actions">
        <div className="flex">
          <Select
            value={status}
            onChange={setStatus}
            placeholder="اختر الحالة الجديدة"
            options={ORDER_STATUSES.filter((s) => s !== order.status).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
          <Button onClick={changeStatus} loading={saving} disabled={!status}>تحديث</Button>
        </div>
      </div></section>
    </div>
  )
}
