import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Badge } from '../../shared/components/ui/Badge'
import { Loading } from '../../shared/components/ui/Loading'
import { useDocument } from '../../shared/hooks/useDocument'
import { useCollection } from '../../shared/hooks/useCollection'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { useToast } from '../../shared/hooks/useToast'
import { cancelExternalShipmentCallable, createOrderShipmentCallable, downloadShipmentDocumentCallable, getMerchantShippingProvidersCallable, receiveOrderReturnCallable, refreshShipmentTrackingCallable, requestOrderReturnCallable, updateOrderStatusCallable, updateShipmentStatusCallable } from '../../shared/services/auth'
import { Button } from '../../shared/components/ui/Button'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import { STATUS_LABELS } from '../../shared/utils/constants'
import { orderItemRevenue } from '../../shared/utils/pricing'
import { publicShipmentTrackingCode } from '../../shared/utils/shipping'
import type { Order, OrderCost, ProductCost, Shipment } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import './OrderDetailsWorkspace.css'

interface Props {
  id: string
}

const PROGRESS: Order['status'][] = ['NEW', 'CONTACTED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
const TERMINAL: Order['status'][] = ['CANCELLED', 'RETURNED']
const ALLOWED_TRANSITIONS: Record<Order['status'], Order['status'][]> = {
  NEW: ['CONTACTED', 'PROCESSING', 'CANCELLED'],
  CONTACTED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
}

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  CREATED: 'تم إنشاء الشحنة', READY_FOR_PICKUP: 'جاهزة للاستلام', PICKED_UP: 'تم الاستلام من المتجر',
  IN_TRANSIT: 'في الطريق', OUT_FOR_DELIVERY: 'خرجت للتسليم', DELIVERED: 'تم التسليم',
  FAILED: 'تعذر التسليم', RETURNING: 'قيد الإرجاع', RETURNED: 'تم الإرجاع', CANCELLED: 'أُلغيت الشحنة',
}
const MANUAL_SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  CREATED: ['READY_FOR_PICKUP', 'CANCELLED'], READY_FOR_PICKUP: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'RETURNING'], IN_TRANSIT: ['OUT_FOR_DELIVERY', 'RETURNING'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED', 'RETURNING'], FAILED: ['OUT_FOR_DELIVERY', 'RETURNING'],
  RETURNING: ['RETURNED'], DELIVERED: [], RETURNED: [], CANCELLED: [],
}

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export const OrderDetailsWorkspace: FunctionalComponent<Props> = ({ id }) => {
  const { store } = useStore()
  const { user } = useAuth()
  const tenantId = store?.id || user?.storeIds?.[0] || ''
  const ordersRes = useCollection<Order>('orders', { storeId: tenantId, orderBy: { field: 'createdAt' } }, !!tenantId)
  const order = ordersRes.data.find((item) => item.id === id) || null
  const loading = ordersRes.loading
  const { data: orderCost } = useDocument<OrderCost>('orderCosts', order?.id || null)
  const { data: shipment } = useDocument<Shipment>('shipments', order?.activeShipmentId || null)
  const costsRes = useCollection<ProductCost>('productCosts', { storeId: order?.storeId || '__none__' }, !!order?.storeId)
  const toast = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<Order['status'] | null>(null)
  const [saving, setSaving] = useState(false)
  const [shippingChoices, setShippingChoices] = useState<Array<{ provider: { id: string; name: string; slug?: string; canCreateShipment?: boolean; canTrackShipment?: boolean; canCancelShipment?: boolean }; config: { enabled?: boolean } | null }>>([])
  const [shippingProviderId, setShippingProviderId] = useState('')
  const [shipmentAction, setShipmentAction] = useState<string | null>(null)
  const [nextManualShipmentStatus, setNextManualShipmentStatus] = useState('')

  useEffect(() => {
    if (!tenantId) return
    void getMerchantShippingProvidersCallable({ storeId: tenantId }).then((result) => {
      const rows = ((result.data as any)?.providers || []) as Array<{ provider: { id: string; name: string; slug?: string; canCreateShipment?: boolean; canTrackShipment?: boolean; canCancelShipment?: boolean }; config: { enabled?: boolean; isDefault?: boolean } | null }>
      setShippingChoices(rows.filter((row) => row.config?.enabled))
      const preferred = rows.find((row) => row.config?.enabled && row.config?.isDefault) || rows.find((row) => row.config?.enabled)
      if (preferred) setShippingProviderId((current) => current || preferred.provider.id)
    }).catch(() => setShippingChoices([]))
  }, [tenantId])

  if (loading) return <Loading variant="screen" message="جاري تحميل الطلب..." />
  if (!order) return <div className="card p-6 text-center muted">الطلب غير موجود أو لا تملك صلاحية الوصول إليه</div>

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
  const margin = grossRevenue > 0 ? Math.round((grossProfit / grossRevenue) * 100) : 0

  const stepIndex = PROGRESS.indexOf(order.status)
  const isTerminal = TERMINAL.includes(order.status)
  const statusLabel = STATUS_LABELS[order.status as keyof typeof STATUS_LABELS] || order.status
  const isApiShipment = Boolean(shipment && (shipment.integrationType === 'api' || ['wasla', 'bosta'].includes(String(shipment.provider || shipment.providerId || '').toLowerCase())))
  const shipmentTrackingCode = shipment ? (publicShipmentTrackingCode(shipment.provider || shipment.providerId, shipment.trackingNumber)
    || publicShipmentTrackingCode(shipment.provider || shipment.providerId, shipment.providerShipmentId)
    || shipment.trackingNumber || shipment.providerShipmentId || null) : null
  const currentShipmentStatus = String(shipment?.currentStatus || shipment?.status || 'CREATED')
  const shipmentProvider = shippingChoices.find((row) => row.provider.id === shipment?.providerId)?.provider
  const selectedProvider = shippingChoices.find((row) => row.provider.id === shippingProviderId)?.provider
  const hasExternalShipment = Boolean(isApiShipment && (shipment?.externalShipmentId || shipment?.providerShipmentId))
  const canTrackShipment = Boolean(shipmentProvider?.canTrackShipment)
  const canCancelShipment = Boolean(shipmentProvider?.canCancelShipment)
  const shipmentCancellationEligible = ['CREATED', 'READY_FOR_PICKUP', 'FAILED'].includes(currentShipmentStatus)
  const orderCancellationEligible = ['NEW', 'CONTACTED', 'PROCESSING'].includes(order.status)
  const visibleStatusLabel = currentShipmentStatus === 'FAILED' ? 'تعذر التسليم — يحتاج متابعة' : statusLabel
  const manualShipmentChoices = shipment && !isApiShipment ? (MANUAL_SHIPMENT_TRANSITIONS[currentShipmentStatus] || []) : []
  const orderTransitions = (ALLOWED_TRANSITIONS[order.status] || []).filter((status) => !shipment || !['SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'].includes(status))

  const statusTime = (s: Order['status']) => {
    const hit = (order.statusHistory || []).find((h) => h.status === s)
    return hit ? formatDateTime(hit.at) : null
  }

  const confirmStatus = async () => {
    if (!pendingStatus || pendingStatus === order.status) return
    setSaving(true)
    try {
      await updateOrderStatusCallable({ orderId: order.id, status: pendingStatus })
      toast.push('تم تحديث حالة الطلب')
      setMenuOpen(false)
      setSheetOpen(false)
    } catch {
      toast.push('تعذر تحديث الحالة', undefined, 'error')
    } finally {
      setSaving(false)
      setPendingStatus(null)
    }
  }

  const print = () => {
    const w = window.open('', '_blank')
    if (!w) {
      window.print()
      return
    }
      w.document.write(`<html dir="rtl"><head><title>${order.orderNumber}</title></head><body style="font-family:Cairo,sans-serif;padding:24px">
      <h1>${order.orderNumber}</h1>
      <p>${order.customerName} — ${order.phone}</p>
      <p>${order.address}</p>
      <hr/><ul>${order.items.map((i) => `<li>${i.name} × ${i.quantity} — ${formatCurrency(i.lineTotal ?? i.price * i.quantity)}</li>`).join('')}</ul>
      <hr/><p><strong>الإجمالي: ${formatCurrency(order.totalPrice)}</strong></p></body></html>`)
    w.document.close()
    w.print()
  }

  const createShipment = async () => {
    if (!shippingProviderId) { toast.push('فعّل شركة شحن أولاً', undefined, 'error'); return }
    setShipmentAction('create')
    try {
      await createOrderShipmentCallable({ orderId: order.id, providerId: shippingProviderId, retry: order.shippingCreationStatus === 'FAILED' })
      toast.push('تم إنشاء الشحنة')
    } catch (err: any) { toast.push('تعذر إنشاء الشحنة', err?.message || 'تحقق من إعدادات شركة الشحن', 'error') }
    finally { setShipmentAction(null) }
  }

  const refreshShipment = async () => {
    if (!shipment?.id) return
    setShipmentAction('refresh')
    try { await refreshShipmentTrackingCallable({ shipmentId: shipment.id }); toast.push('تم تحديث حالة الشحنة') }
    catch (err: any) { toast.push('تعذر تحديث التتبع', err?.message || 'حاول مرة أخرى', 'error') }
    finally { setShipmentAction(null) }
  }

  const cancelOrder = async () => {
    if (!orderCancellationEligible) return
    if (hasExternalShipment && !canCancelShipment) {
      toast.push('شركة الشحن الحالية لا تتيح الإلغاء التلقائي عبر API.', 'ألغِ الشحنة من لوحة الشركة أولًا، ثم حدّث الحالة من متجري بعد أن تؤكد الشركة الإلغاء.', 'error')
      return
    }
    const message = hasExternalShipment
      ? 'سيتم محاولة إلغاء الشحنة لدى شركة الشحن أولًا، وبعد تأكيد الإلغاء سيتم إلغاء الطلب وإعادة المخزون.'
      : 'سيتم إلغاء الطلب وإعادة المخزون الذي خُصم عند إنشائه. هل تريد المتابعة؟'
    if (!window.confirm(message)) return
    setShipmentAction('cancel')
    try {
      if (hasExternalShipment && shipment?.id) await cancelExternalShipmentCallable({ shipmentId: shipment.id })
      else await updateOrderStatusCallable({ orderId: order.id, status: 'CANCELLED' })
      toast.push(hasExternalShipment ? 'تم إلغاء الطلب والشحنة وإعادة المخزون' : 'تم إلغاء الطلب وإعادة المخزون')
    } catch (err: any) {
      toast.push('تعذر إتمام الإلغاء', err?.message || 'لم يتغير الطلب ولم تتم إعادة المخزون.', 'error')
    } finally { setShipmentAction(null) }
  }

  const updateManualShipment = async () => {
    if (!shipment?.id || !nextManualShipmentStatus) return
    setShipmentAction('manual-status')
    try {
      await updateShipmentStatusCallable({ shipmentId: shipment.id, status: nextManualShipmentStatus })
      toast.push('تم تحديث حالة الشحنة والطلب تلقائيًا')
      setNextManualShipmentStatus('')
    } catch (err: any) { toast.push('تعذر تحديث حالة الشحنة', err?.message || 'راجع المرحلة الحالية للشحنة', 'error') }
    finally { setShipmentAction(null) }
  }

  const requestReturn = async () => {
    setShipmentAction('request-return')
    try {
      await requestOrderReturnCallable({ orderId: order.id })
      toast.push('تم تسجيل طلب استلام المرتجع', 'أكد الاستلام فقط بعد وصول المنتجات إلى المتجر.')
    } catch (err: any) { toast.push('تعذر طلب المرتجع', err?.message || 'حاول مرة أخرى', 'error') }
    finally { setShipmentAction(null) }
  }

  const receiveReturn = async () => {
    setShipmentAction('receive-return')
    try {
      await receiveOrderReturnCallable({ orderId: order.id })
      await updateOrderStatusCallable({ orderId: order.id, status: 'RETURNED' })
      toast.push('تم استلام المرتجع وإعادة المنتجات للمخزون')
    } catch (err: any) { toast.push('تعذر إتمام استلام المرتجع', err?.message || 'حاول مرة أخرى', 'error') }
    finally { setShipmentAction(null) }
  }

  const downloadShipmentDocument = async () => {
    if (!shipment?.id) return
    setShipmentAction('document')
    try {
      const result = await downloadShipmentDocumentCallable({ shipmentId: shipment.id })
      const document = result.data as any
      const binary = atob(String(document.contentBase64 || ''))
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: document.contentType || 'application/pdf' }))
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = document.fileName || `shipment-${shipment.trackingNumber || shipment.id}.pdf`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      toast.push('تم تحميل مستند الشحنة من Bosta')
    } catch (err: any) { toast.push('تعذر تحميل مستند الشحنة', err?.message || 'حاول مرة أخرى', 'error') }
    finally { setShipmentAction(null) }
  }

  const statusMenu = (onPick: (s: Order['status']) => void) => (
    <div className="ods-status-menu">
      <ul>
        {PROGRESS.filter((s) => orderTransitions.includes(s)).map((s) => (
          <li key={s}>
            <button type="button" onClick={() => { setMenuOpen(false); setSheetOpen(false); onPick(s) }}>
              {STATUS_LABELS[s] || s}
              {s === 'DELIVERED' && <span className="ods-delivered-tag">تم التوصيل</span>}
            </button>
          </li>
        ))}
        {TERMINAL.some((s) => orderTransitions.includes(s)) && <li className="ods-status-divider" />}
        {TERMINAL.filter((s) => orderTransitions.includes(s)).map((s) => (
          <li key={s}>
            <button type="button" className="ods-terminal-option" onClick={() => { setMenuOpen(false); setSheetOpen(false); onPick(s) }}>
              {STATUS_LABELS[s] || s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className="ods-workspace">
      <div className="ods-header">
        <div>
          <h2 className="ods-title">
            <span className="ods-status-pill">{visibleStatusLabel}</span>
            <span className="ods-number">{order.orderNumber}</span>
          </h2>
          <p className="ods-date"><Icon name="calendar_today" ariaHidden /> {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="ods-header-actions">
          <button type="button" className="ods-btn-bordered" onClick={print}><Icon name="print" ariaHidden /> طباعة</button>
          {orderTransitions.length > 0 && <div className="ods-status-dropdown">
            <button type="button" className="ods-btn-primary" onClick={() => setMenuOpen(!menuOpen)}>
              تحديث الحالة <Icon name="expand_more" ariaHidden />
            </button>
            {menuOpen && statusMenu((s) => setPendingStatus(s))}
          </div>}
        </div>
      </div>

      <div className="ods-grid">
        <div className="ods-main">
          <div className="ods-card">
            <div className="ods-card-header">
              <h3><Icon name="inventory_2" ariaHidden /> المنتجات</h3>
              <span>{order.items.length} منتج</span>
            </div>
            <div className="ods-table-scroll">
              <table className="ods-items-table">
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>الكمية</th>
                    <th>سعر الوحدة</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <div className="ods-item-cell">
                          <div className="ods-item-thumb"><Icon name="inventory_2" ariaHidden /></div>
                          <div>
                            <p className="ods-item-name">{it.name}</p>
                            <p className="ods-item-meta">
                              {it.color && <span className="ods-option-chip">{it.color}</span>}
                              {it.size && <span className="ods-option-chip">{it.size}</span>}
                              {it.pricingMode === 'quantity' && it.quantityTier && <span className="ods-option-chip">سعر الكميات</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{it.quantity}</td>
                      <td>{formatCurrency(it.unitPrice ?? it.price)}</td>
                      <td className="ods-item-total">{formatCurrency(it.lineTotal ?? it.price * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ods-card">
            <div className="ods-card-header">
              <h3><Icon name="route" ariaHidden /> حالة الطلب</h3>
            </div>
            <div className="ods-timeline">
              {PROGRESS.map((s, i) => {
                const done = stepIndex >= 0 && i <= stepIndex
                const active = i === stepIndex
                const t = statusTime(s)
                return (
                  <div key={s} className={`ods-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}${!done && !active ? ' is-upcoming' : ''}`}>
                    <span className="ods-step-dot">{done && !active ? <Icon name="check" /> : null}</span>
                    <div className="ods-step-body">
                      <h4>{active && s === 'SHIPPED' && currentShipmentStatus === 'FAILED' ? 'تعذر التسليم' : (STATUS_LABELS[s] || s)}</h4>
                      <p>{active ? (t || 'الآن') : done ? (t || '—') : 'في الانتظار'}</p>
                      {active && order.status === 'PROCESSING' && <p className="ods-step-note">جاري تجهيز المنتجات في المستودع.</p>}
                      {active && order.status === 'SHIPPED' && currentShipmentStatus === 'FAILED' && <p className="ods-step-note">تعذر التسليم؛ راجع سبب التعذر في بطاقة الشحنة واتخذ الإجراء المناسب.</p>}
                    </div>
                  </div>
                )
              })}
            </div>
            {isTerminal && (
              <div className="ods-terminal">
                <Badge tone="red">{statusLabel}</Badge>
                <span className="muted small">هذا الطلب في حالة نهائية ولا يمكن متابعة تنفيذه.</span>
              </div>
            )}
          </div>
        </div>

        <div className="ods-sidebar">
          <div className="ods-card ods-customer-card">
            <h3 className="ods-sidebar-title"><Icon name="person" ariaHidden /> العميل</h3>
            <div className="ods-kv">
              <div>
                <p className="ods-kv-label">الاسم</p>
                <p className="ods-kv-value">{order.customerName}</p>
              </div>
              <div>
                <p className="ods-kv-label">رقم الهاتف</p>
                <p className="ods-kv-value">
                  <span className="ltr-text">{order.phone}</span>
                  <button type="button" className="ods-copy-btn" title="نسخ رقم الهاتف" onClick={async () => {
                    const ok = await copy(order.phone)
                    toast.push(ok ? 'تم نسخ الرقم' : 'تعذر النسخ', undefined, ok ? undefined : 'error')
                  }}><Icon name="content_copy" ariaHidden /></button>
                </p>
              </div>
              <div>
                <p className="ods-kv-label">العنوان</p>
                <p className="ods-kv-value">{[order.governorate, order.city].filter(Boolean).join(' — ')}{order.address ? `، ${order.address}` : ''}</p>
              </div>
              {order.notes && (
                <div>
                  <p className="ods-kv-label">ملاحظات</p>
                  <p className="ods-kv-value">{order.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="ods-card ods-summary-card">
            <h3 className="ods-sidebar-title"><Icon name="receipt_long" ariaHidden /> ملخص الدفع</h3>
            <div className="ods-kv">
              <div><p className="ods-kv-label">المجموع الفرعي</p><p className="ods-kv-value">{formatCurrency(order.subtotal)}</p></div>
              <div><p className="ods-kv-label">الشحن</p><p className="ods-kv-value">{formatCurrency(order.shippingFee)}</p></div>
              {order.discount > 0 && <div><p className="ods-kv-label">الخصم</p><p className="ods-kv-value">-{formatCurrency(order.discount)}</p></div>}
              <div className="ods-kv-total"><p className="ods-kv-label">الإجمالي</p><p className="ods-kv-value">{formatCurrency(order.totalPrice)}</p></div>
              <div><p className="ods-kv-label">طريقة الدفع</p><p className="ods-kv-value">{order.paymentMethod === 'cod' ? 'الدفع عند الاستلام' : order.paymentMethod === 'bank' ? 'تحويل بنكي' : order.paymentMethod}</p></div>
            </div>
          </div>

          <div className="ods-card">
            <h3 className="ods-sidebar-title"><Icon name="local_shipping" ariaHidden /> الشحنة</h3>
            {order.activeShipmentId && shipment ? <div className="stack-list">
              <div className="shipping-secure-note"><Icon name={isApiShipment ? 'cloud_sync' : 'edit_note'} ariaHidden /><span>{isApiShipment ? `شحنة API متصلة بـ${shipment.providerName || 'شركة الشحن'}؛ الشركة هي مصدر الحالة، لذلك لا تعديل يدوي هنا.` : 'شحنة يدوية: حدّث مرحلتها هنا فقط وسيتم تحديث حالة الطلب تلقائيًا.'}</span></div>
              <div className="ods-kv">
                <div><p className="ods-kv-label">شركة الشحن</p><p className="ods-kv-value">{shipment.providerName || '—'}</p></div>
                <div><p className="ods-kv-label">كود الشحنة الخارجي</p><p className="ods-kv-value ltr-text">{shipment.externalShipmentId || shipment.providerShipmentId || '—'}</p></div>
                <div><p className="ods-kv-label">كود التتبع</p><p className="ods-kv-value ltr-text">{shipmentTrackingCode || 'بانتظار كود المتابعة'}</p></div>
                <div><p className="ods-kv-label">الحالة المحلية</p><p className="ods-kv-value">{SHIPMENT_STATUS_LABELS[currentShipmentStatus] || currentShipmentStatus}</p></div>
                <div><p className="ods-kv-label">آخر حالة من الشركة</p><p className="ods-kv-value">{shipment.remoteStatus == null ? '—' : String(shipment.remoteStatus)}</p></div>
                <div><p className="ods-kv-label">آخر مزامنة</p><p className="ods-kv-value">{shipment.lastSyncedAt ? formatDateTime(shipment.lastSyncedAt) : '—'}</p></div>
                {currentShipmentStatus === 'FAILED' && shipment.failureReason && <div><p className="ods-kv-label">سبب تعذر التسليم</p><p className="ods-kv-value">{shipment.failureReason}</p></div>}
              </div>
              <div className="flex" style={{ gap: 8 }}>
                {shipment.trackingUrl && <a className="btn btn-outline btn-sm" href={shipment.trackingUrl} target="_blank" rel="noreferrer">تتبع</a>}
                {isApiShipment && canTrackShipment && <Button size="sm" variant="outline" loading={shipmentAction === 'refresh'} disabled={shipmentAction !== null} onClick={refreshShipment}>تحديث الحالة</Button>}
                {shipment.documentAvailable && <Button size="sm" variant="outline" loading={shipmentAction === 'document'} disabled={shipmentAction !== null} onClick={downloadShipmentDocument}>مستند الشحنة</Button>}
              </div>
              {!isApiShipment && manualShipmentChoices.length > 0 && <div className="stack-list">
                <label className="field"><span className="field-label">المرحلة التالية للشحنة</span><select className="input" value={nextManualShipmentStatus} onChange={(event) => setNextManualShipmentStatus((event.target as HTMLSelectElement).value)}><option value="">اختر الحالة</option>{manualShipmentChoices.map((status) => <option key={status} value={status}>{SHIPMENT_STATUS_LABELS[status] || status}</option>)}</select></label>
                <Button size="sm" loading={shipmentAction === 'manual-status'} disabled={!nextManualShipmentStatus || shipmentAction !== null} onClick={updateManualShipment}>حفظ حالة الشحنة</Button>
              </div>}
            </div> : shippingChoices.length === 0 ? <p className="muted small">لا توجد شركة شحن مفعلة لهذا المتجر.</p> : <div className="stack-list">
              {order.shippingCreationStatus === 'FAILED' && <div className="alert alert-error"><strong>تعذر إنشاء الشحنة</strong><span>{order.shippingCreationErrorMessage || 'تحقق من إعدادات شركة الشحن ثم أعد المحاولة.'}</span></div>}
              <select className="input" value={shippingProviderId} onChange={(e) => setShippingProviderId((e.target as HTMLSelectElement).value)}>{shippingChoices.map((row) => <option value={row.provider.id} key={row.provider.id}>{row.provider.name}</option>)}</select>
              <Button size="sm" loading={shipmentAction === 'create'} disabled={shipmentAction !== null || selectedProvider?.canCreateShipment !== true} onClick={createShipment}>{order.shippingCreationStatus === 'FAILED' ? 'إعادة محاولة الإنشاء' : 'إنشاء الشحنة'}</Button>
            </div>}
            {orderCancellationEligible && <div className="stack-list mt-2">
              {hasExternalShipment && !canCancelShipment && <div className="alert alert-error"><strong>شركة الشحن الحالية لا تتيح الإلغاء التلقائي عبر API.</strong><span>ألغِ الشحنة من لوحة الشركة أولًا، ثم حدّث حالتها من متجري بعد التأكيد. لن نعرض نجاحًا محليًا قبل تأكيد الشركة.</span></div>}
              {(!hasExternalShipment || (canCancelShipment && shipmentCancellationEligible)) && <Button size="sm" variant="outline" loading={shipmentAction === 'cancel'} disabled={shipmentAction !== null} onClick={cancelOrder}>{hasExternalShipment ? 'إلغاء الطلب والشحنة' : 'إلغاء الطلب'}</Button>}
            </div>}
          </div>

          {Array.isArray(order.statusHistory) && order.statusHistory.some((event) => event.title) && <div className="ods-card">
            <h3 className="ods-sidebar-title"><Icon name="history" ariaHidden /> سجل دورة الطلب</h3>
            <div className="stack-list">{order.statusHistory.filter((event) => event.title).slice(-10).reverse().map((event, index) => <div key={event.eventId || `${event.status}-${index}`} className="ods-kv"><div><p className="ods-kv-value">{event.title}</p><p className="ods-kv-label">{formatDateTime(event.at)}{event.source ? ` — ${event.source}` : ''}{event.provider ? ` — ${event.provider}` : ''}</p></div></div>)}</div>
          </div>}

          {order.status === 'DELIVERED' && <div className="ods-card">
            <h3 className="ods-sidebar-title"><Icon name="assignment_return" ariaHidden /> مرتجع العميل</h3>
            {order.returnStatus === 'REQUESTED' || order.returnStatus === 'RECEIVED' ? <div className="stack-list">
              <p className="muted small m-0">{order.returnStatus === 'RECEIVED' ? 'تم تأكيد وصول المرتجع. أكمل العملية لإعادة المنتجات إلى المخزون.' : 'تم طلب المرتجع. أكد الاستلام عند وصول المنتجات فعليًا إلى المتجر.'}</p>
              <Button size="sm" variant="outline" loading={shipmentAction === 'receive-return'} disabled={shipmentAction !== null} onClick={receiveReturn}>{order.returnStatus === 'RECEIVED' ? 'إتمام الاستلام وإعادة المخزون' : 'تأكيد استلام المرتجع'}</Button>
            </div> : <div className="stack-list">
              <p className="muted small m-0">يسجل طلب استلام من العميل، ولا يعيد المنتجات للمخزون قبل تأكيد وصولها.</p>
              <Button size="sm" variant="outline" loading={shipmentAction === 'request-return'} disabled={shipmentAction !== null} onClick={requestReturn}>طلب استلام مرتجع</Button>
            </div>}
          </div>}

          <div className="ods-card ods-profit-card">
            <h3 className="ods-sidebar-title"><Icon name="monitoring" ariaHidden /> الربح الإجمالي</h3>
            {hasCosts ? (
              <div className="ods-kv">
                <div><p className="ods-kv-label">تكلفة المنتجات</p><p className="ods-kv-value">{formatCurrency(cogs)}</p></div>
                <div className="ods-profit-total"><p className="ods-kv-label">إجمالي الربح</p><p className="ods-kv-value">{formatCurrency(grossProfit)}</p></div>
                <div className="ods-margin-badge">هامش الربح: {margin}%</div>
              </div>
            ) : (
              <p className="muted small m-0">أضف أسعار التكلفة للمنتجات لعرض الأرباح.</p>
            )}
          </div>
        </div>
      </div>

      <div className="ods-mobile-bar">
        <button type="button" className="ods-more-btn" onClick={print} title="طباعة"><Icon name="more_vert" ariaHidden /></button>
        {orderTransitions.length > 0 && <button type="button" className="ods-update-btn" onClick={() => setSheetOpen(!sheetOpen)}>
          تحديث الحالة <Icon name="edit" ariaHidden />
        </button>}
      </div>

      {sheetOpen && (
        <div className="ods-sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <div className="ods-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ods-sheet-handle" />
            <h3>تحديث حالة الطلب</h3>
            <div className="ods-sheet-options">{statusMenu((s) => setPendingStatus(s))}</div>
          </div>
        </div>
      )}

      {pendingStatus && (
        <div className="ods-confirm-backdrop">
          <div className="ods-confirm">
            <h3>تأكيد تحديث الحالة</h3>
            <p>
              <strong>{order.orderNumber}</strong> ← <strong className="ods-confirm-status">{STATUS_LABELS[pendingStatus] || pendingStatus}</strong>
            </p>
            <div className="ods-confirm-actions">
              <button type="button" className="ods-btn-bordered" onClick={() => setPendingStatus(null)}>إلغاء</button>
              <button type="button" className="ods-btn-primary" onClick={confirmStatus} disabled={saving}>{saving ? 'جاري التحديث...' : 'تأكيد التحديث'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default OrderDetailsWorkspace
