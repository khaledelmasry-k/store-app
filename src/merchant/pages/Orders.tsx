import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Icon } from '../../shared/components/ui/Icon'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Pagination } from '../../shared/components/ui/Pagination'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Loading } from '../../shared/components/ui/Loading'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { Link } from 'wouter'
import { formatCurrency, timeAgo } from '../../shared/utils/format'
import { orderItemRevenue } from '../../shared/utils/pricing'
import { STATUS_LABELS } from '../../shared/utils/constants'
import { visibleOrderStatusLabel, visibleOrderStatusTone } from '../../shared/utils/order-status'
import type { Order, ProductCost, Shipment } from '../../shared/types'
import './Orders.css'

const PILL_TONES: Record<string, string> = {
  green: 'tone-green',
  red: 'tone-red',
  amber: 'tone-amber',
  slate: 'tone-slate',
  indigo: 'tone-indigo',
  blue: 'tone-blue',
  purple: 'tone-purple',
}

const PAYMENT_ICONS: Record<string, string> = {
  cod: 'local_shipping',
  bank: 'account_balance',
}

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'الدفع عند الاستلام',
  bank: 'تحويل بنكي',
}

export const MerchantOrders: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  // Sort locally so legacy timestamp shapes cannot leave the tenant query
  // waiting on an unavailable composite index in the local emulator.
  const ordersRes = useCollection<Order>('orders', { storeId })
  const orders = ordersRes.data
  const shipmentsRes = useCollection<Shipment>('shipments', { storeId }, !!storeId)
  const shipmentByOrder = new Map<string, Shipment>()
  for (const shipment of shipmentsRes.data) {
    const previous = shipmentByOrder.get(shipment.orderId)
    const currentAt = shipment.updatedAt?.seconds || shipment.lastSyncedAt?.seconds || 0
    const previousAt = previous?.updatedAt?.seconds || previous?.lastSyncedAt?.seconds || 0
    if (!previous || shipment.active === true || currentAt >= previousAt) shipmentByOrder.set(shipment.orderId, shipment)
  }
  const costsRes = useCollection<ProductCost>('productCosts', { storeId }, !!storeId)
  const costByProduct = new Map(costsRes.data.map((c) => [c.id, c.costPrice]))
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [payment, setPayment] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const statusCounts = Object.fromEntries(
    Object.keys(STATUS_LABELS).map((k) => [k, orders.filter((o) => o.status === k).length])
  )

  const filtered = orders
    .filter((o) =>
      (((o.customerName || "").includes(query) || (o.orderNumber || "").includes(query) || (o.phone || "").includes(query)) &&
      (!status || o.status === status) &&
      (!payment || o.paymentMethod === payment))
    )
    .sort((a, b) => {
      if (sort === 'newest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      if (sort === 'oldest') return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
      if (sort === 'total') return b.totalPrice - a.totalPrice
      return 0
    })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const totalRevenue = orders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + o.totalPrice, 0)
  const pendingCount = orders.filter((o) => ['NEW', 'CONTACTED', 'PROCESSING'].includes(o.status)).length
  const orderProfit = (o: Order): number | null => {
    let hasCost = false
    let profit = 0
    for (const it of o.items || []) {
      const cost = costByProduct.get(it.productId)
      if (typeof cost !== 'number' || cost < 0) continue
      hasCost = true
      profit += orderItemRevenue(it) - Math.max(1, it.quantity || 1) * cost
    }
    return hasCost ? profit : null
  }
  const totalProfit = orders
    .filter((o) => o.status === 'DELIVERED')
    .reduce((sum, o) => sum + (orderProfit(o) ?? 0), 0)
  
  if (ordersRes.loading || costsRes.loading) return <Loading variant="screen" message="جاري تحميل الطلبات..." />

  const filtersActive = !!query || !!status || !!payment

  return (
    <div className="merchant-operations merchant-orders-page">
      <PageHeader
        breadcrumb="تشغيل المتجر"
        title="الطلبات"
        subtitle={`${orders.length} طلب — الربح يظهر للتاجر فقط بناءً على تكلفة المنتجات المسجلة`}
      />

      <div className="stats-grid">
        <StatsCard title="إجمالي الطلبات" value={orders.length} icon="shopping_bag" tone="primary" />
        <StatsCard title="المبيعات المستلمة" value={totalRevenue} currency icon="payments" tone="green" />
        <StatsCard title="إجمالي الربح" value={totalProfit} currency icon="trending_up" tone="indigo" changeLabel="يعتمد على تكلفة المنتجات المسجلة" />
        <StatsCard title="الطلبات المعلقة" value={pendingCount} icon="pending_actions" tone="amber" />
      </div>

      <div className="orders-toolbar">
        <div className="orders-toolbar-row">
          <div className="orders-search">
            <Icon name="search" ariaHidden />
            <input type="text" placeholder="البحث برقم الطلب، اسم العميل، الهاتف..." value={query} onInput={(e) => { setQuery((e.target as HTMLInputElement).value); setPage(1) }} aria-label="بحث في الطلبات" />
          </div>
          <div className="orders-toolbar-actions">
            <div className="orders-select">
              <select value={payment} onChange={(e) => { setPayment((e.target as HTMLSelectElement).value); setPage(1) }} aria-label="طريقة الدفع">
                <option value="">طريقة الدفع: الكل</option>
                <option value="cod">الدفع عند الاستلام</option>
                <option value="bank">تحويل بنكي</option>
              </select>
              <Icon name="expand_more" ariaHidden />
            </div>
            <div className="orders-select">
              <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value)} aria-label="الترتيب">
                <option value="newest">الأحدث</option>
                <option value="oldest">الأقدم</option>
                <option value="total">الأعلى قيمة</option>
              </select>
              <Icon name="expand_more" ariaHidden />
            </div>
          </div>
        </div>

        <div className="orders-status-pills">
          <button type="button" className={!status ? 'is-active' : ''} onClick={() => { setStatus(''); setPage(1) }}>الكل</button>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <button type="button" key={k} className={status === k ? 'is-active' : ''} onClick={() => { setStatus(status === k ? '' : k); setPage(1) }}>
              {v} ({statusCounts[k] || 0})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="archive"
          title="لا توجد طلبات"
          description={filtersActive ? 'لا توجد نتائج تطابق البحث والفلترة.' : 'عندما يقوم العملاء بالشراء من متجرك، ستظهر طلباتهم هنا لإدارتها.'}
        />
      ) : (
        <div className="orders-table">
          <div className="orders-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>الرقم</th>
                  <th>العميل</th>
                  <th>المنتجات</th>
                  <th>الإجمالي</th>
                  <th>الربح</th>
                  <th>الدفع</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                  <th className="actions-col">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const profit = orderProfit(o)
                  const shipment = shipmentByOrder.get(o.id)
                  const shipmentFailed = String(shipment?.currentStatus || shipment?.status || o.shipmentStatus || '').toUpperCase() === 'FAILED'
                  const tone = shipmentFailed ? 'red' : visibleOrderStatusTone(o)
                  const statusText = shipmentFailed ? 'تعذر التسليم' : visibleOrderStatusLabel(o)
                  const statusTitle = shipmentFailed ? (shipment?.failureReason || 'تعذر التسليم. لم ترسل شركة الشحن سببًا تفصيليًا عبر الربط.') : undefined
                  return (
                    <tr key={o.id} className="order-row" onClick={() => (window.location.href = `/dashboard/orders/${o.id}`)}>
                      <td data-label="الرقم"><Link href={`/dashboard/orders/${o.id}`} className="order-number">{o.orderNumber}</Link></td>
                      <td data-label="العميل">
                        <div className="order-customer">
                          <span className="order-customer-name">{o.customerName || '—'}</span>
                          {o.phone && <span className="order-customer-phone">{o.phone}</span>}
                        </div>
                      </td>
                      <td data-label="المنتجات"><ProductsCell items={o.items} /></td>
                      <td data-label="الإجمالي"><span className="order-total">{formatCurrency(o.totalPrice)}</span></td>
                      <td data-label="الربح">
                        {profit == null ? (
                          <span className="order-cost-chip">تكلفة غير مكتملة</span>
                        ) : (
                          <span className={`order-profit ${profit < 0 ? 'is-negative' : ''}`}>{formatCurrency(profit)}</span>
                        )}
                      </td>
                      <td data-label="الدفع">
                        <span className="order-payment-chip">
                          <Icon name={PAYMENT_ICONS[o.paymentMethod] || 'payments'} ariaHidden />
                          {PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod || '—'}
                        </span>
                      </td>
                      <td data-label="الحالة">
                        <span className={`order-status-pill ${PILL_TONES[tone] || ''}`} title={statusTitle}>
                          <span className="order-status-dot" />
                          {statusText}
                        </span>
                      </td>
                      <td data-label="التاريخ"><span className="order-date">{timeAgo(o.createdAt)}</span></td>
                      <td data-label="الإجراءات" className="actions-col">
                        <span className="order-actions">
                          <Link href={`/dashboard/orders/${o.id}`} title="عرض التفاصيل" className="icon-btn"><Icon name="visibility" /></Link>
                          <Link href={`/dashboard/orders/${o.id}`} title="تعديل" className="icon-btn"><Icon name="edit" /></Link>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={(p) => { setPage(p); window.scrollTo(0, 0) }} />
        </div>
      )}
    </div>
  )
}

function ProductsCell({ items }: { items: Order['items'] }) {
  const list = items || []
  if (list.length === 0) return <span className="muted small">—</span>
  const total = list.reduce((s, i) => s + (i.quantity || 0), 0)
  return (
    <div className="order-products">
      <span className="order-products-name" title={list.map((i) => i.name).join('، ')}>{list[0].name}</span>
      <span className="muted small">{total} قطعة</span>
    </div>
  )
}

export default MerchantOrders
