import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { PageHeader } from '../../shared/components/ui/PageHeader'
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
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/utils/constants'
import type { Order } from '../../shared/types'

export const MerchantOrders: FunctionalComponent = () => {
  const { store } = useStore()
  const storeId = store?.id || ''
  const ordersRes = useCollection<Order>('orders', { storeId, orderBy: { field: 'createdAt' } })
  const orders = ordersRes.data
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [payment, setPayment] = useState('')
  const [sort] = useState('newest')
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

  if (ordersRes.loading) return <Loading />

  return (
    <div>
      <PageHeader title="الطلبات" subtitle={`${orders.length} طلب`} />

      <div className="stats-grid">
        <StatsCard title="إجمالي الطلبات" value={orders.length} icon="receipt_long" tone="primary" />
        <StatsCard title="المبلغ" value={totalRevenue} currency icon="payments" tone="green" />
        <StatsCard title="معلقة" value={pendingCount} icon="pending_actions" tone="amber" />
      </div>

      <Card>
        <FilterBar
          search={query}
          onSearch={(q) => { setQuery(q); setPage(1) }}
          searchPlaceholder="بحث برقم الطلب أو العميل..."
          segments={[{ label: 'كل', value: '' }, ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ label: v, value: k }))]}
          activeSegment={status}
          onSegmentChange={(s) => { setStatus(s); setPage(1) }}
          actions={
            <Select value={payment} onChange={(v) => { setPayment(v); setPage(1) }} placeholder="طريقة الدفع" options={[{ value: '', label: 'كل الطرق' }, ...paymentOptions]} />
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
              { key: 'totalPrice', header: 'الإجمالي', render: (o: Order) => formatCurrency(o.totalPrice) },
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
    </div>
  )
}
export default MerchantOrders