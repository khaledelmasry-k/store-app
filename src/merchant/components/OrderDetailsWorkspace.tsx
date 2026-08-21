import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Badge } from '../../shared/components/ui/Badge'
import { Loading } from '../../shared/components/ui/Loading'
import { useDocument } from '../../shared/hooks/useDocument'
import { useCollection } from '../../shared/hooks/useCollection'
import { useToast } from '../../shared/hooks/useToast'
import { updateOrderStatusCallable } from '../../shared/services/auth'
import { formatCurrency, formatDateTime } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import { orderItemRevenue } from '../../shared/utils/pricing'
import type { Order, OrderCost, ProductCost } from '../../shared/types'
import { Icon } from '../../shared/components/ui/Icon'
import './OrderDetailsWorkspace.css'

interface Props {
  id: string
}

const PROGRESS: Order['status'][] = ['NEW', 'CONTACTED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
const TERMINAL: Order['status'][] = ['CANCELLED', 'RETURNED']

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export const OrderDetailsWorkspace: FunctionalComponent<Props> = ({ id }) => {
  const { data: order, loading } = useDocument<Order>('orders', id)
  const { data: orderCost } = useDocument<OrderCost>('orderCosts', order?.id || null)
  const costsRes = useCollection<ProductCost>('productCosts', { storeId: order?.storeId || '__none__' }, !!order?.storeId)
  const toast = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<Order['status'] | null>(null)
  const [saving, setSaving] = useState(false)

  if (loading) return <Loading variant="screen" message="جاري تحميل الطلب..." />
  if (!order) return <div className="card p-6 text-center muted">الطلب غير موجود</div>

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
    w.document.write(`<html dir="rtl"><head><title>${order.orderNumber}</title></head><body style="font-family:sans-serif;padding:24px">
      <h1>${order.orderNumber}</h1>
      <p>${order.customerName} — ${order.phone}</p>
      <p>${order.address}</p>
      <hr/><ul>${order.items.map((i) => `<li>${i.name} × ${i.quantity} — ${formatCurrency(i.lineTotal ?? i.price * i.quantity)}</li>`).join('')}</ul>
      <hr/><p><strong>الإجمالي: ${formatCurrency(order.totalPrice)}</strong></p></body></html>`)
    w.document.close()
    w.print()
  }

  const statusMenu = (onPick: (s: Order['status']) => void) => (
    <div className="ods-status-menu">
      <ul>
        {PROGRESS.map((s) => (
          <li key={s}>
            <button type="button" className={s === order.status ? 'is-current' : ''} onClick={() => { setMenuOpen(false); setSheetOpen(false); onPick(s) }}>
              {STATUS_LABELS[s] || s}
              {s === order.status && <span className="ods-current-tag">(حالي)</span>}
              {s === 'DELIVERED' && <span className="ods-delivered-tag">تم التوصيل</span>}
            </button>
          </li>
        ))}
        <li className="ods-status-divider" />
        {TERMINAL.map((s) => (
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
            <span className="ods-status-pill">{statusLabel}</span>
            <span className="ods-number">{order.orderNumber}</span>
          </h2>
          <p className="ods-date"><Icon name="calendar_today" ariaHidden /> {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="ods-header-actions">
          <button type="button" className="ods-btn-bordered" onClick={print}><Icon name="print" ariaHidden /> طباعة</button>
          <div className="ods-status-dropdown">
            <button type="button" className="ods-btn-primary" onClick={() => setMenuOpen(!menuOpen)}>
              تحديث الحالة <Icon name="expand_more" ariaHidden />
            </button>
            {menuOpen && statusMenu((s) => setPendingStatus(s))}
          </div>
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
                      <h4>{STATUS_LABELS[s] || s}</h4>
                      <p>{active ? (t || 'الآن') : done ? (t || '—') : 'في الانتظار'}</p>
                      {active && order.status === 'PROCESSING' && <p className="ods-step-note">جاري تجهيز المنتجات في المستودع.</p>}
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
        <button type="button" className="ods-update-btn" onClick={() => setSheetOpen(!sheetOpen)}>
          تحديث الحالة <Icon name="edit" ariaHidden />
        </button>
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