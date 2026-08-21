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
import { Loading } from '../ui/Loading'

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

  if (loading) return <Loading variant="screen" message="جاري تحميل الطلب..." />
  if (!order) return <Card title="الطلب غير موجود" />

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
      <Card className="mb-2">
        <div className="flex-between flex-wrap">
          <div>
            <span className="eyebrow muted small">معرّف الطلب</span>
            <h2 className="page-title"><span className="monospace">{order.orderNumber}</span></h2>
          </div>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>
      </Card>

      <div className="order-detail-grid">
        <aside className="order-detail-timeline">
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
        </aside>

        <main className="order-detail-items">
          <Card title="المنتجات" subtitle={`${order.items.length} منتج مع الخيارات والكميات والأسعار`}>
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
          </Card>
        </main>

        <aside className="order-detail-sidebar">
          <Card className="order-customer-card" title="معلومات العميل" subtitle="بيانات الشحن والتواصل المرتبطة بالطلب">
              <dl className="kv">
                <div className="kv-item"><dt>الاسم</dt><dd>{order.customerName}</dd></div>
                <div className="kv-item"><dt>الهاتف</dt><dd>{order.phone}</dd></div>
                <div className="kv-item"><dt>المحافظة</dt><dd>{order.governorate}</dd></div>
                <div className="kv-item"><dt>المدينة</dt><dd>{order.city}</dd></div>
                <div className="kv-item"><dt>العنوان</dt><dd>{order.address}</dd></div>
                {order.notes && <div className="kv-item"><dt>ملاحظات</dt><dd>{order.notes}</dd></div>}
              </dl>
          </Card>

          <Card className="order-summary-card" title="ملخص الطلب" subtitle="القيمة، الدفع والتاريخ">
              <dl className="kv">
                <div className="kv-item"><dt>المجموع الفرعي</dt><dd>{formatCurrency(order.subtotal)}</dd></div>
                <div className="kv-item"><dt>الشحن</dt><dd>{formatCurrency(order.shippingFee)}</dd></div>
                {order.discount > 0 && <div className="kv-item"><dt>الخصم</dt><dd>-{formatCurrency(order.discount)}</dd></div>}
                <div className="kv-item"><dt>الإجمالي</dt><dd>{formatCurrency(order.totalPrice)}</dd></div>
                <div className="kv-item"><dt>طريقة الدفع</dt><dd>{order.paymentMethod === 'cod' ? 'عند الاستلام' : order.paymentMethod === 'bank' ? 'تحويل بنكي' : order.paymentMethod}</dd></div>
                <div className="kv-item"><dt>التاريخ</dt><dd>{formatDateTime(order.createdAt)}</dd></div>
              </dl>
          </Card>

          <Card className="order-profit-card" title="الربح الإجمالي" subtitle="إيرادات الطلب مطروحاً منها تكلفة البضاعة المباعة">
              {hasCosts ? (
                <div className="kv">
                  <div className="kv-item"><dt>إيرادات الطلب</dt><dd>{formatCurrency(grossRevenue)}</dd></div>
                  <div className="kv-item"><dt>تكلفة البضاعة (COGS)</dt><dd>{formatCurrency(cogs)}</dd></div>
                  <div className="kv-item"><dt>الربح الإجمالي</dt><dd className={grossProfit < 0 ? 'text-red font-semibold' : 'font-semibold'}>{formatCurrency(grossProfit)}</dd></div>
                </div>
              ) : (
                <p className="muted small m-0">أضف أسعار التكلفة للمنتجات لعرض الأرباح.</p>
              )}
          </Card>

          <Card className="order-status-card" title="تغيير الحالة" subtitle="تحديث حالة الطلب وفق دورة العمل الحالية">
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
        </aside>
      </div>
    </div>
  )
}