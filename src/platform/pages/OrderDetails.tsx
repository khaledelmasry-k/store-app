import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Link } from 'wouter'
import { Breadcrumb } from '../../shared/components/ui/Breadcrumb'
import { useCollection } from '../../shared/hooks/useCollection'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Table } from '../../shared/components/ui/Table'
import { Loading } from '../../shared/components/ui/Loading'
import { Button } from '../../shared/components/ui/Button'
import { Select } from '../../shared/components/ui/Select'
import { useToast } from '../../shared/hooks/useToast'
import { getOrderIntegrationEventsCallable, updateOrderStatusCallable } from '../../shared/services/auth'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import type { Order, Shipment, Store, ShippingProviderDefinition } from '../../shared/types'

interface Props {
  id: string
}

const ORDER_TRANSITIONS: Record<string, string[]> = {
  NEW: ['CONTACTED', 'PROCESSING', 'CANCELLED'],
  CONTACTED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
}

export const PlatformOrderDetails: FunctionalComponent<Props> = ({ id }) => {
  // Platform order reads follow the same authorized collection query as the
  // platform order list. Direct document reads are intentionally denied by
  // Firestore rules, so selecting by id from this result preserves security
  // without weakening the document rules.
  const ordersRes = useCollection<Order>('orders', {})
  const shipments = useCollection<Shipment>('shipments', { where: { orderId: { value: id } }, orderBy: { field: 'createdAt' } }, Boolean(id))
  const stores = useCollection<Store>('stores', {})
  const providers = useCollection<ShippingProviderDefinition>('shippingProviders', {})
  const toast = useToast()
  const [nextStatus, setNextStatus] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [integrationEvents, setIntegrationEvents] = useState<Array<any>>([])
  useEffect(() => {
    let active = true
    getOrderIntegrationEventsCallable({ orderId: id })
      .then((result: any) => { if (active) setIntegrationEvents(result.data?.events || []) })
      .catch(() => { if (active) setIntegrationEvents([]) })
    return () => { active = false }
  }, [id])
  if (ordersRes.loading) return <Loading variant="screen" />
  const order = ordersRes.data.find((candidate) => candidate.id === id)
  if (!order) return <div className="platform-operations"><PageHeader title="تفاصيل الطلب" /><Card>الطلب غير موجود</Card></div>
  const store = stores.data.find((s) => s.id === order.storeId)
  const availableTransitions = ORDER_TRANSITIONS[order.status] || []
  const updateStatus = async () => {
    if (!nextStatus || updatingStatus) return
    setUpdatingStatus(true)
    try {
      await updateOrderStatusCallable({ orderId: order.id, status: nextStatus })
      toast.push('تم تحديث حالة الطلب')
      setNextStatus('')
    } catch (error: any) {
      toast.push('تعذر تحديث حالة الطلب', error?.message || 'حاول مرة أخرى', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }
  return <div className="platform-operations platform-order-details-page">
    <Breadcrumb items={[{ label: 'الطلبات', href: '/platform/orders' }, { label: order.orderNumber }]} />
    <PageHeader title={`طلب ${order.orderNumber}`} subtitle="مراقبة المنصة — عرض آمن للمدير" actions={<Badge tone={(STATUS_COLORS[order.status] as any) || 'slate'}>{STATUS_LABELS[order.status] || order.status}</Badge>} />
    <div className="platform-order-overview">
      <Card title="الملكية والتوقيت"><dl className="kv"><div className="kv-item"><dt>المتجر</dt><dd>{store?.name || order.storeId}</dd></div><div className="kv-item"><dt>العميل</dt><dd>{order.customerName}</dd></div><div className="kv-item"><dt>الهاتف</dt><dd>{order.phone}</dd></div><div className="kv-item"><dt>التاريخ</dt><dd>{formatDateTime(order.createdAt)}</dd></div></dl></Card>
      <Card title="الإجماليات"><dl className="kv"><div className="kv-item"><dt>المجموع الفرعي</dt><dd>{formatCurrency(order.subtotal)}</dd></div><div className="kv-item"><dt>الشحن</dt><dd>{formatCurrency(order.shippingFee)}</dd></div><div className="kv-item"><dt>الخصم</dt><dd>{formatCurrency(order.discount || 0)}</dd></div><div className="kv-item"><dt>الإجمالي</dt><dd className="font-semibold">{formatCurrency(order.totalPrice)}</dd></div><div className="kv-item"><dt>الدفع</dt><dd>{order.paymentMethod}</dd></div></dl></Card>
    </div>
    <Card title="إدارة حالة الطلب" subtitle="تغيير الحالة يسجل في التدقيق ويشغّل أتمتة الشحن المهيأة للمتجر.">
      {availableTransitions.length ? <div className="flex" style={{ gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
        <Select label="الحالة التالية" value={nextStatus} onChange={setNextStatus} placeholder="اختر الحالة" options={availableTransitions.map((status) => ({ value: status, label: STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status }))} />
        <Button icon="save" loading={updatingStatus} disabled={!nextStatus} onClick={updateStatus}>تأكيد تغيير الحالة</Button>
      </div> : <span className="muted">هذه حالة نهائية ولا يوجد انتقال آخر متاح.</span>}
    </Card>
    <Card title="سجل الأتمتة" subtitle="نتيجة محاولة إنشاء الشحنة والعمليات الآلية المرتبطة بهذا الطلب.">
      {integrationEvents.length ? <Table cardMode columns={[{ key: 'eventType', header: 'الحدث', render: (event: any) => event.eventType }, { key: 'processingStatus', header: 'الحالة', render: (event: any) => event.processingStatus }, { key: 'outcome', header: 'النتيجة', render: (event: any) => event.outcome || '—' }, { key: 'errorMessage', header: 'التفاصيل', render: (event: any) => event.errorMessage || '—' }]} rows={integrationEvents} /> : <span className="muted">لا توجد عمليات آلية مسجلة لهذا الطلب بعد.</span>}
    </Card>
    <Card title="المنتجات" subtitle={`${order.items.length} منتج`}><Table cardMode columns={[{ key: 'name', header: 'المنتج' }, { key: 'quantity', header: 'الكمية' }, { key: 'price', header: 'السعر', render: (i: any) => formatCurrency(i.price) }, { key: 'lineTotal', header: 'الإجمالي', render: (i: any) => formatCurrency(i.lineTotal ?? i.price * i.quantity) }]} rows={order.items as any} /></Card>
    <Card title="شركة الشحن ومحاولاته" subtitle="لقطات الأسعار التاريخية غير قابلة للتغيير" className="platform-shipping-panel">
      {shipments.data.length ? <Table cardMode columns={[{ key: 'providerName', header: 'شركة الشحن', render: (s: Shipment) => { const provider = providers.data.find((p) => p.id === s.providerId); return provider ? <Link href={`/platform/shipping-companies/${provider.id}`} className="font-semibold">{provider.name} — عرض شركة الشحن</Link> : (s.providerName || s.shippingCompanyName || '—') } }, { key: 'status', header: 'حالة الشحنة', render: (s: Shipment) => s.status || '—' }, { key: 'trackingNumber', header: 'التتبع', render: (s: Shipment) => s.trackingNumber || '—' }, { key: 'customerFee', header: 'رسوم العميل', render: (s: Shipment) => `${s.customerShippingFee || 0} ج.م` }, { key: 'carrierCost', header: 'تكلفة الناقل', render: (s: Shipment) => `${s.carrierShippingCost || s.priceSnapshot?.deliveryPrice || 0} ج.م` }, { key: 'zone', header: 'المنطقة/السعر', render: (s: Shipment) => s.priceSnapshot ? `${s.priceSnapshot.zoneId || '—'} / ${s.priceSnapshot.deliveryPrice} ج.م` : '—' }, { key: 'createdAt', header: 'التاريخ', render: (s: Shipment) => formatDateTime(s.createdAt) }]} rows={shipments.data} /> : <div className="platform-no-carrier"><strong>لم يتم تعيين شركة شحن</strong><span className="muted">لا توجد محاولات شحن مرتبطة بهذا الطلب.</span></div>}
    </Card>
  </div>
}
export default PlatformOrderDetails
