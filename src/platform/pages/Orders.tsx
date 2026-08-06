import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { StatsCard } from '../../shared/components/ui/StatsCard'
import { Table } from '../../shared/components/ui/Table'
import { Badge } from '../../shared/components/ui/Badge'
import { FilterBar } from '../../shared/components/ui/FilterBar'
import { Pagination } from '../../shared/components/ui/Pagination'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Loading } from '../../shared/components/ui/Loading'
import { useCollection } from '../../shared/hooks/useCollection'
import { Link } from 'wouter'
import { formatCurrency, timeAgo } from '../../shared/utils/format'
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import type { Order } from '../../shared/types'

export const PlatformOrders: FunctionalComponent = () => {
  const ordersRes = useCollection<Order>('orders', { orderBy: { field: 'createdAt' } })
  const orders = ordersRes.data
  const storesRes = useCollection('stores', {})
  const stores = storesRes.data
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const filtered = orders.filter(
    (o) =>
      (o.customerName.includes(query) || o.orderNumber.includes(query) || o.phone.includes(query)) &&
      (!status || o.status === status),
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const totalRevenue = orders.reduce((s, o) => s + o.totalPrice, 0)
  const pendingCount = orders.filter((o) => ['NEW', 'CONTACTED', 'PROCESSING'].includes(o.status)).length
  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length

  if (ordersRes.loading) return <Loading />

  return (
    <div>
      <PageHeader title="طلبات المنصة" subtitle={`${orders.length} طلب عبر جميع المتاجر`} />

      <div className="stats-grid">
        <StatsCard title="إجمالي الطلبات" value={orders.length} icon="receipt_long" tone="primary" />
        <StatsCard title="المبلغ الإجمالي" value={totalRevenue} currency icon="payments" tone="green" />
        <StatsCard title="معلقة" value={pendingCount} icon="pending_actions" tone="amber" />
        <StatsCard title="تم التسليم" value={deliveredCount} icon="check_circle" tone="blue" />
      </div>

      <Card>
        <FilterBar
          search={query}
          onSearch={(q) => { setQuery(q); setPage(1) }}
          searchPlaceholder="بحث برقم الطلب أو العميل..."
          segments={[{ label: 'كل', value: '' }, ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ label: v, value: k }))]}
          activeSegment={status}
          onSegmentChange={(s) => { setStatus(s); setPage(1) }}
        />
        {filtered.length === 0 ? (
          <EmptyState icon="receipt_long" title="لا توجد طلبات" description={query ? 'لا توجد نتائج للبحث' : 'لا توجد طلبات بعد'} />
        ) : (
          <Table cardMode
            columns={[
              { key: 'orderNumber', header: 'الرقم', render: (o: Order) => <Link href={`/platform/orders/${o.id}`}><span className="monospace">{o.orderNumber}</span></Link> },
              { key: 'storeId', header: 'المتجر', render: (o: Order) => (stores.find((s: any) => s.id === o.storeId) as any)?.name || '—' },
              { key: 'customerName', header: 'العميل' },
              { key: 'phone', header: 'الهاتف' },
              { key: 'totalPrice', header: 'الإجمالي', render: (o: Order) => formatCurrency(o.totalPrice) },
              { key: 'status', header: 'الحالة', render: (o: Order) => <Badge tone={STATUS_COLORS[o.status]}>{STATUS_LABELS[o.status]}</Badge> },
              { key: 'createdAt', header: 'التاريخ', render: (o: Order) => <span className="muted">{timeAgo(o.createdAt)}</span> },
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
    </div>
  )
}
export default PlatformOrders