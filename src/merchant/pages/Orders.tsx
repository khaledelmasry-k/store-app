import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { Pagination } from '../../shared/components/ui/Pagination'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Loading } from '../../shared/components/ui/Loading'
import { Select } from '../../shared/components/ui/Select'
import { useStore } from '../../shared/hooks/useStore'
import { useCollection } from '../../shared/hooks/useCollection'
import { Link } from 'wouter'
import { formatCurrency, timeAgo } from '../../shared/utils/format'
import { orderItemRevenue } from '../../shared/utils/pricing'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import type { Order, ProductCost } from '../../shared/types'
import { InternalPageHeader, WorkspaceSection } from '../components/InternalWorkspace'
import '../components/InternalWorkspace.css'

export const MerchantOrders: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const ordersRes = useCollection<Order>('orders', { storeId, orderBy: { field: 'createdAt' } })
  const orders = ordersRes.data
  const costsRes = useCollection<ProductCost>('productCosts', { storeId }, !!storeId)
  const costByProduct = new Map(costsRes.data.map((c) => [c.id, c.costPrice]))
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [payment, setPayment] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const paymentOptions = [
    { value: 'cod', label: 'الدفع عند الاستلام' },
    { value: 'bank', label: 'تحويل بنكي' },
  ]

  const filtered = orders
    .filter((o) =>
      (o.customerName.includes(query) || o.orderNumber.includes(query) || o.phone.includes(query)) &&
      (!status || o.status === status) &&
      (!payment || o.paymentMethod === payment)
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
  const hasAnyCost = costsRes.data.some((c) => typeof c.costPrice === 'number' && c.costPrice >= 0)

  if (ordersRes.loading || costsRes.loading) return <Loading />

  return (
    <div className="merchant-operations merchant-orders-page">
      <InternalPageHeader eyebrow="تشغيل المتجر" title="الطلبات" subtitle={`${orders.length} طلب — تابع الحالات والقيمة والربح من مساحة عمل واحدة`} />

      <div className="stats-grid">
        <StatsCard title="إجمالي الطلبات" value={orders.length} icon="receipt_long" tone="primary" />
        <StatsCard title="المبلغ" value={totalRevenue} currency icon="payments" tone="green" />
        {hasAnyCost && <StatsCard title="الربح" value={totalProfit} currency icon="trending_up" tone="violet" />}
        <StatsCard title="معلقة" value={pendingCount} icon="pending_actions" tone="amber" />
      </div>

      <WorkspaceSection title="سجل الطلبات" subtitle="ابحث وفلتر الطلبات ثم افتح التفاصيل التشغيلية" className="orders-workspace">
      <Card>
        <FilterBar
          search={query}
          onSearch={(q) => { setQuery(q); setPage(1) }}
          searchPlaceholder="بحث برقم الطلب أو العميل..."
          segments={[{ label: 'كل', value: '' }, ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ label: v, value: k }))]}
          activeSegment={status}
          onSegmentChange={(s) => { setStatus(s); setPage(1) }}
          actions={
            <div className="flex gap-1">
              <Select value={sort} onChange={(v) => setSort(v)} placeholder="الترتيب" options={[
                { value: 'newest', label: 'الأحدث' },
                { value: 'oldest', label: 'الأقدم' },
                { value: 'total', label: 'الأعلى قيمة' },
              ]} />
              <Select value={payment} onChange={(v) => { setPayment(v); setPage(1) }} placeholder="طريقة الدفع" options={[{ value: '', label: 'كل الطرق' }, ...paymentOptions]} />
            </div>
          }
        />
        {filtered.length === 0 ? (
          <EmptyState icon="receipt_long" title="لا توجد طلبات" description={query ? 'لا توجد نتائج تطابق بحثك.' : 'الطلبات ستظهر هنا فور وصولها.'} />
        ) : (
          <Table cardMode
            columns={[
              { key: 'orderNumber', header: 'الرقم', render: (o: Order) => <Link href={`/dashboard/orders/${o.id}`}><span className="monospace">{o.orderNumber}</span></Link> },
              { key: 'customerName', header: 'العميل' },
               { key: 'phone', header: 'الهاتف' },
               { key: 'items', header: 'المنتجات', render: (o: Order) => <ProductsCell items={o.items} /> },
               { key: 'totalPrice', header: 'الإجمالي', render: (o: Order) => formatCurrency(o.totalPrice) },
              { key: 'profit', header: 'الربح', render: (o: Order) => {
                const profit = orderProfit(o)
                if (profit == null) return <span className="profit-chip is-missing">تكلفة غير مكتملة</span>
                return <span className={`profit-chip${profit < 0 ? ' is-negative' : ''}`}>{formatCurrency(profit)}</span>
              } },
              { key: 'paymentMethod', header: 'الدفع', render: (o: Order) => <Badge tone="blue">{o.paymentMethod === 'cod' ? 'عند الاستلام' : 'تحويل بنكي'}</Badge> },
              { key: 'status', header: 'الحالة', render: (o: Order) => <Badge tone={STATUS_COLORS[o.status]}>{STATUS_LABELS[o.status]}</Badge> },
              { key: 'createdAt', header: 'التاريخ', render: (o: Order) => <span className="muted">{timeAgo(o.createdAt)}</span> },
              { key: 'actions', header: '', render: (o: Order) => <Link href={`/dashboard/orders/${o.id}`}><Button variant="ghost" size="sm" icon="arrow_forward_ios" /></Link> },
            ]}
            rows={rows}
          />
        )}
        {filtered.length > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={(p) => { setPage(p); window.scrollTo(0, 0) }}
          />
        )}
      </Card>
      </WorkspaceSection>
    </div>
  )
}

function ProductsCell({ items }: { items: Order['items'] }) {
  const list = items || []
  if (list.length === 0) return <span className="muted small">—</span>
  const total = list.reduce((s, i) => s + (i.quantity || 0), 0)
  return (
    <div className="flex flex-col" style={{ lineHeight: 1.3 }}>
      <span className="muted small" title={list.map((i) => i.name).join('، ')} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list[0].name}</span>
      <span className="muted small">{total} قطعة</span>
    </div>
  )
}

export default MerchantOrders
